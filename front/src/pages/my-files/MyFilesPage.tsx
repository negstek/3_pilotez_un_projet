import type { FileHistoryItem, FileStatusFilter } from '@datashare/shared-lib'
import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client.ts'
import { deleteFile, listMyFiles } from '../../api/files.ts'
import { useAuth } from '../../auth/AuthContext.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Callout } from '../../components/ui/Callout.tsx'
import { FileInfo } from '../../components/ui/FileInfo.tsx'
import { expiryLabel, formatDate, formatSize } from '../../files/format.ts'
import { MyFilesLayout } from './MyFilesLayout.tsx'
import '../pages.css'

/** Options of the "Tous / Actifs / Expiré" switch of the mockups, mapped to the `status` filter of GET /files. */
const FILTERS: { value: FileStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'expired', label: 'Expiré' },
]

/** Loading the history, then either the list or the message of the API. */
type ListState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; files: FileHistoryItem[] }

const UNEXPECTED_ERROR = 'Une erreur inattendue est survenue.'

/** Message to show for a failed call; any other error than ApiError is a bug, reported without details. */
const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : UNEXPECTED_ERROR)

/** Lock of the mockups, shown on password-protected files. */
function LockIcon() {
  return (
    <svg className="my-files__lock" viewBox="0 0 24 24" role="img" aria-label="Protégé par un mot de passe">
      <title>Protégé par un mot de passe</title>
      <path d="M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v10H5z" />
    </svg>
  )
}

interface FileRowProps {
  file: FileHistoryItem
  /** True while this file's deletion is in progress: its button is disabled. */
  deleting: boolean
  onDelete: (file: FileHistoryItem) => void
}

/**
 * Line of the history (US05): name, size, upload date, expiry date and state of the link. An active file can be opened or deleted; an
 * expired one only shows the explanation of the mockups, since its link no longer works.
 */
function FileRow({ file, deleting, onDelete }: Readonly<FileRowProps>) {
  const expired = file.status === 'expired'
  const detail = (
    <>
      {formatSize(file.sizeBytes)} · Envoyé le {formatDate(file.createdAt)} ·{' '}
      <span className={expired ? 'my-files__expired' : undefined}>{expiryLabel(file.expiresAt, file.status)}</span>
    </>
  )
  const actions = (
    <div className="my-files__actions">
      {file.passwordProtected && <LockIcon />}
      {expired ? (
        <p className="my-files__expired-note">Ce fichier a expiré, il n'est plus stocké chez nous</p>
      ) : (
        <>
          {/* The file name in the accessible name: every line has the same two buttons. */}
          <Button aria-label={`Supprimer ${file.originalName}`} disabled={deleting} onClick={() => onDelete(file)}>
            Supprimer
          </Button>
          <a className="btn btn--primary" href={file.downloadUrl} aria-label={`Accéder à ${file.originalName}`}>
            Accéder →
          </a>
        </>
      )}
    </div>
  )

  return (
    <li className="my-files__item">
      <FileInfo name={file.originalName} detail={detail} action={actions} />
    </li>
  )
}

/**
 * "Mes fichiers" screen of the mockups: history of the user's files (US05) and their deletion (US06). Only the active files are shown by
 * default (US06), although the mockup selects "Tous": the specifications prevail.
 */
export function MyFilesPage() {
  const { token, logout } = useAuth()
  const [filter, setFilter] = useState<FileStatusFilter>('active')
  const [list, setList] = useState<ListState>({ status: 'loading' })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    // Ignores a late answer if the filter changed (or the page closed) in the meantime.
    let current = true
    listMyFiles(filter, token).then(
      (files) => current && setList({ status: 'ready', files }),
      (error: unknown) => {
        if (!current) return
        // Session expired on the server side: logging out lets RequireAuth send the user to the login page, which brings them back here.
        if (error instanceof ApiError && error.status === 401) logout()
        else setList({ status: 'error', message: messageOf(error) })
      },
    )
    return () => {
      current = false
    }
  }, [filter, token, logout])

  const changeFilter = (next: FileStatusFilter) => {
    if (next === filter) return
    setFilter(next)
    setList({ status: 'loading' })
    setDeleteError(null)
  }

  const removeFromList = (id: string) =>
    setList((state) => (state.status === 'ready' ? { status: 'ready', files: state.files.filter((file) => file.id !== id) } : state))

  const onDelete = async (file: FileHistoryItem) => {
    // US06: "confirmation de l'action requise côté front-end", the deletion being irreversible.
    if (!window.confirm(`Supprimer définitivement « ${file.originalName} » ? Cette action est irréversible.`)) return
    setDeleteError(null)
    setDeletingId(file.id)
    try {
      await deleteFile(file.id, token)
      removeFromList(file.id)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout()
        return
      }
      // Already deleted (from another tab) or purged: the list catches up with the server, and the message explains why.
      if (error instanceof ApiError && error.status === 404) removeFromList(file.id)
      setDeleteError(messageOf(error))
    } finally {
      setDeletingId(null)
    }
  }

  let content
  if (list.status === 'loading') content = <p className="my-files__message">Chargement…</p>
  else if (list.status === 'error') content = <Callout variant="error">{list.message}</Callout>
  else if (list.files.length === 0) content = <p className="my-files__message">Aucun fichier à afficher.</p>
  else
    content = (
      <ul className="my-files__list">
        {list.files.map((file) => (
          <FileRow key={file.id} file={file} deleting={deletingId === file.id} onDelete={onDelete} />
        ))}
      </ul>
    )

  return (
    <MyFilesLayout>
      <h1 className="my-files__title">Mes fichiers</h1>
      <div className="my-files__filter" role="group" aria-label="Filtrer par état du lien">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={value === filter ? 'my-files__filter-option my-files__filter-option--selected' : 'my-files__filter-option'}
            aria-pressed={value === filter}
            onClick={() => changeFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {deleteError && <Callout variant="error">{deleteError}</Callout>}
      {content}
    </MyFilesLayout>
  )
}

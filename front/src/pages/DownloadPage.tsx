import type { FilePublicMetadata } from '@datashare/shared-lib'
import { useEffect, useState, type SubmitEvent } from 'react'
import { useParams } from 'react-router'
import { ApiError } from '../api/client.ts'
import { downloadFile, getFileMetadata } from '../api/files.ts'
import { Button } from '../components/ui/Button.tsx'
import { Callout } from '../components/ui/Callout.tsx'
import { Card } from '../components/ui/Card.tsx'
import { FileInfo } from '../components/ui/FileInfo.tsx'
import { Input } from '../components/ui/Input.tsx'
import { PublicLayout } from '../components/ui/PublicLayout.tsx'
import { expiryNotice, formatSize } from '../files/format.ts'
import './pages.css'

/** Loading the metadata, then either the download form ("ready") or an explicit message (unknown, expired or unreachable link). */
type PageState = { status: 'loading' } | { status: 'unavailable'; message: string } | { status: 'ready'; metadata: FilePublicMetadata }

const UNEXPECTED_ERROR = 'Une erreur inattendue est survenue.'

/** Hands a downloaded file to the browser, which saves it under its original name. */
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Released once the browser has started the save; revoking it synchronously can cancel the download in some browsers (Firefox).
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * "Télécharger un fichier" screen of the mockups (US02), reached through the shared link /f/:token without an account. The metadata is
 * shown before the download; an unknown or expired link gets the explicit message of the API.
 */
export function DownloadPage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [password, setPassword] = useState('')
  // Two places for errors: under the password field (401 / 422 of a protected file), or in a banner above the form (anything else).
  const [passwordError, setPasswordError] = useState<string>()
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    // Ignores a late answer if the link changed (or the page closed) in the meantime.
    let current = true
    getFileMetadata(token).then(
      (metadata) => current && setState({ status: 'ready', metadata }),
      (error: unknown) =>
        current && setState({ status: 'unavailable', message: error instanceof ApiError ? error.message : UNEXPECTED_ERROR }),
    )
    return () => {
      current = false
    }
  }, [token])

  if (state.status !== 'ready') {
    return (
      <PublicLayout>
        <Card title="Télécharger un fichier">
          {state.status === 'loading' ? (
            <p className="download__loading">Chargement…</p>
          ) : (
            <Callout variant="error">{state.message}</Callout>
          )}
        </Card>
      </PublicLayout>
    )
  }

  const { metadata } = state
  const notice = expiryNotice(metadata.expiresAt)

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError(undefined)
    setDownloadError(null)
    setDownloading(true)
    try {
      saveFile(await downloadFile(token, password), metadata.originalName)
    } catch (error) {
      if (!(error instanceof ApiError)) setDownloadError(UNEXPECTED_ERROR)
      // Expired since the page was opened, or purged: same screen as an unavailable link.
      else if (error.status === 404 || error.status === 410) setState({ status: 'unavailable', message: error.message })
      // Wrong (401) or missing (422) password: shown under the field, or in the banner if the page did not expect a password.
      else if ((error.status === 401 || error.status === 422) && metadata.passwordProtected) setPasswordError(error.message)
      else setDownloadError(error.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <PublicLayout>
      <Card title="Télécharger un fichier">
        <form className="download" onSubmit={onSubmit} noValidate>
          <FileInfo name={metadata.originalName} detail={formatSize(metadata.sizeBytes)} />
          <Callout variant={notice.variant}>{notice.text}</Callout>
          {downloadError && <Callout variant="error">{downloadError}</Callout>}
          {metadata.passwordProtected && (
            <Input
              label="Mot de passe"
              type="password"
              autoComplete="off"
              placeholder="Saisissez le mot de passe..."
              value={password}
              error={passwordError}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
          {/* US02: the password is required only for a protected file; the button waits for it, as in the mockups. */}
          <Button type="submit" block disabled={downloading || (metadata.passwordProtected && !password)}>
            {downloading ? 'Téléchargement…' : 'Télécharger'}
          </Button>
        </form>
      </Card>
    </PublicLayout>
  )
}

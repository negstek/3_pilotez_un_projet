import type { FileHistoryItem } from '@datashare/shared-lib'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client.ts'
import { deleteFile, listMyFiles } from '../../api/files.ts'
import { RequireAuth } from '../../auth/RequireAuth.tsx'
import { loadSession, saveSession } from '../../auth/session.ts'
import { fakeJwt } from '../../test/jwt.ts'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { MyFilesPage } from './MyFilesPage.tsx'

// The API module is mocked: these tests cover the screen (US05 / US06), the HTTP side is covered by client.test.ts and the back's e2e tests.
vi.mock('../../api/files.ts')

const DAY_MS = 24 * 60 * 60 * 1000

/** History item: active PDF of 2.6 MB, uploaded yesterday, expiring in 3 days, unless overridden. */
const item = (overrides: Partial<FileHistoryItem> = {}): FileHistoryItem => ({
  id: 'f1',
  originalName: 'rapport.pdf',
  sizeBytes: 2_726_297,
  createdAt: new Date(Date.now() - DAY_MS).toISOString(),
  expiresAt: new Date(Date.now() + 3 * DAY_MS).toISOString(),
  status: 'active',
  passwordProtected: false,
  downloadUrl: 'https://localhost:8080/f/abc',
  ...overrides,
})

const expired = item({
  id: 'f2',
  originalName: 'vacances.mp4',
  expiresAt: new Date(Date.now() - DAY_MS).toISOString(),
  status: 'expired',
  passwordProtected: true,
})

describe('MyFilesPage — history (US05) and deletion (US06)', () => {
  const token = fakeJwt(3600)

  beforeEach(() => {
    vi.mocked(listMyFiles).mockReset()
    vi.mocked(deleteFile).mockReset()
    vi.restoreAllMocks()
    saveSession({ accessToken: token, user: { id: 'u1', email: 'alice@test.fr' } })
  })

  /** Logged-in user on /mon-espace, whose history is `files` whatever the filter. */
  const renderPage = (files: FileHistoryItem[]) => {
    vi.mocked(listMyFiles).mockResolvedValue(files)
    renderWithProviders(<MyFilesPage />, { route: '/mon-espace', path: '/mon-espace' })
    return userEvent.setup()
  }

  it('shows the active files by default (US06), with name, size, dates and lock', async () => {
    renderPage([item({ passwordProtected: true })])

    const row = await screen.findByRole('listitem')
    expect(listMyFiles).toHaveBeenCalledWith('active', token)
    expect(screen.getByRole('button', { name: 'Actifs' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(row).getByText('rapport.pdf')).toBeInTheDocument()
    expect(row).toHaveTextContent(/2,6\sMo · Envoyé le \d{2}\/\d{2}\/\d{4} · Expire dans 3 jours, le \d{2}\/\d{2}\/\d{4}/)
    expect(within(row).getByRole('img', { name: 'Protégé par un mot de passe' })).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Accéder à rapport.pdf' })).toHaveAttribute('href', 'https://localhost:8080/f/abc')
  })

  it('reloads the history with the chosen filter; an expired file has no action', async () => {
    const user = renderPage([item()])
    await screen.findByText('rapport.pdf')

    vi.mocked(listMyFiles).mockResolvedValue([expired])
    await user.click(screen.getByRole('button', { name: 'Tous' }))

    expect(listMyFiles).toHaveBeenLastCalledWith('all', token)
    expect(await screen.findByText('vacances.mp4')).toBeInTheDocument()
    expect(screen.getByText(/^Expiré le/)).toBeInTheDocument()
    expect(screen.getByText("Ce fichier a expiré, il n'est plus stocké chez nous")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Supprimer/ })).not.toBeInTheDocument()
  })

  it('says when there is nothing to show', async () => {
    renderPage([])

    expect(await screen.findByText('Aucun fichier à afficher.')).toBeInTheDocument()
  })

  it('deletes a file only after confirmation, then removes it from the list', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    vi.mocked(deleteFile).mockResolvedValue()
    const user = renderPage([item(), item({ id: 'f3', originalName: 'compo.mp3' })])

    await user.click(await screen.findByRole('button', { name: 'Supprimer rapport.pdf' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('« rapport.pdf »'))
    expect(deleteFile).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Supprimer rapport.pdf' }))
    expect(deleteFile).toHaveBeenCalledWith('f1', token)
    await vi.waitFor(() => expect(screen.queryByText('rapport.pdf')).not.toBeInTheDocument())
    expect(screen.getByText('compo.mp3')).toBeInTheDocument()
  })

  it('shows the API message when the deletion fails, and drops a file already deleted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(deleteFile).mockRejectedValue(new ApiError(404, "Ce fichier n'existe pas ou a déjà été supprimé"))
    const user = renderPage([item()])

    await user.click(await screen.findByRole('button', { name: 'Supprimer rapport.pdf' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Ce fichier n'existe pas ou a déjà été supprimé")
    expect(screen.queryByText('rapport.pdf')).not.toBeInTheDocument()
  })

  it('sends the user back to the login page when the session has expired on the server', async () => {
    vi.mocked(listMyFiles).mockRejectedValue(new ApiError(401, 'Unauthorized'))
    // Wrapped like in App: the page logs out, then RequireAuth redirects.
    renderWithProviders(
      <RequireAuth>
        <MyFilesPage />
      </RequireAuth>,
      { route: '/mon-espace', path: '/mon-espace' },
    )

    expect(await screen.findByTestId('location')).toHaveTextContent('/login')
    expect(loadSession()).toBeNull()
  })

  it('logs out and goes back to the home page', async () => {
    const user = renderPage([])

    await user.click(screen.getByRole('button', { name: 'Déconnexion' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/')
    expect(loadSession()).toBeNull()
  })
})

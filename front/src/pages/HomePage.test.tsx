import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client.ts'
import { uploadFile } from '../api/files.ts'
import { saveSession } from '../auth/session.ts'
import { fakeJwt } from '../test/jwt.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { HomePage } from './HomePage.tsx'

// The API module is mocked: these tests cover the upload screen (US01, and US07 for a visitor), the HTTP side is covered by client.test.ts
// and the back's e2e tests.
vi.mock('../api/files.ts')

describe('HomePage — upload (US01 / US07)', () => {
  const token = fakeJwt(3600)
  const file = new File(['contenu'], 'rapport.pdf', { type: 'application/pdf' })

  beforeEach(() => {
    vi.mocked(uploadFile).mockReset()
  })

  /** Someone who has picked `chosen` with the round button: a logged-in user by default, a visitor without session with `asVisitor`. */
  const pick = async (chosen: File, { asVisitor = false } = {}) => {
    if (!asVisitor) saveSession({ accessToken: token, user: { id: 'u1', email: 'alice@test.fr' } })
    renderWithProviders(<HomePage />, { path: '/' })
    const user = userEvent.setup()
    await user.upload(screen.getByLabelText('Fichier à téléverser'), chosen)
    return user
  }

  it('lets a visitor upload without an account, with the same options and no token (US07)', async () => {
    vi.mocked(uploadFile).mockResolvedValue({
      id: 'f1',
      downloadUrl: 'https://localhost:8080/f/abc',
      expiresAt: '2026-10-09T10:00:00.000Z',
    })
    const user = await pick(file, { asVisitor: true })

    // Still on the home screen: the visitor has not been sent to the login page.
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Mot de passe'), 'secret1')
    await user.selectOptions(screen.getByLabelText('Expiration'), '2')
    await user.click(screen.getByRole('button', { name: 'Téléverser' }))

    expect(uploadFile).toHaveBeenCalledWith(file, { password: 'secret1', expiresInDays: 2 }, null)
    expect(await screen.findByRole('link', { name: 'https://localhost:8080/f/abc' })).toBeInTheDocument()
  })

  it('uploads the file with the chosen options, then shows the link to share', async () => {
    vi.mocked(uploadFile).mockResolvedValue({
      id: 'f1',
      downloadUrl: 'https://localhost:8080/f/abc',
      expiresAt: '2026-10-09T10:00:00.000Z',
    })
    const user = await pick(file)

    expect(screen.getByText('rapport.pdf')).toBeInTheDocument()
    // 7 days by default (US01).
    expect(screen.getByLabelText('Expiration')).toHaveValue('7')
    await user.type(screen.getByLabelText('Mot de passe'), 'secret1')
    await user.selectOptions(screen.getByLabelText('Expiration'), '3')
    await user.click(screen.getByRole('button', { name: 'Téléverser' }))

    expect(uploadFile).toHaveBeenCalledWith(file, { password: 'secret1', expiresInDays: 3 }, token)
    expect(await screen.findByRole('link', { name: 'https://localhost:8080/f/abc' })).toBeInTheDocument()
    expect(screen.getByText('Félicitations, ton fichier sera conservé chez nous pendant 3 jours !')).toBeInTheDocument()
  })

  it('refuses a forbidden file as soon as it is chosen', async () => {
    await pick(new File(['MZ'], 'setup.exe'))

    expect(screen.getByText(/Ce type de fichier n'est pas autorisé/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Téléverser' })).toBeDisabled()
  })

  it('refuses a password shorter than 6 characters without calling the API', async () => {
    const user = await pick(file)

    await user.type(screen.getByLabelText('Mot de passe'), '12345')
    await user.click(screen.getByRole('button', { name: 'Téléverser' }))

    expect(screen.getByText('Le mot de passe doit contenir au moins 6 caractères')).toBeInTheDocument()
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('shows the API message when the upload is refused', async () => {
    vi.mocked(uploadFile).mockRejectedValue(new ApiError(422, 'La taille des fichiers est limitée à 1 Go'))
    const user = await pick(file)

    await user.click(screen.getByRole('button', { name: 'Téléverser' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La taille des fichiers est limitée à 1 Go')
    expect(screen.getByRole('button', { name: 'Téléverser' })).toBeEnabled()
  })

  it('asks a user whose session is no longer accepted to log in again, and keeps them logged in to retry', async () => {
    vi.mocked(uploadFile).mockRejectedValue(new ApiError(401, 'Unauthorized'))
    const user = await pick(file)

    await user.click(screen.getByRole('button', { name: 'Téléverser' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Votre session a expiré : reconnectez-vous pour téléverser un fichier.')
    // A second attempt still sends the token: it must not become an anonymous upload.
    await user.click(screen.getByRole('button', { name: 'Téléverser' }))
    expect(uploadFile).toHaveBeenLastCalledWith(file, { password: '', expiresInDays: 7 }, token)
  })
})

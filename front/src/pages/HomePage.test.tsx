import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client.ts'
import { uploadFile } from '../api/files.ts'
import { saveSession } from '../auth/session.ts'
import { fakeJwt } from '../test/jwt.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { HomePage } from './HomePage.tsx'

// The API module is mocked: these tests cover the upload screen (US01), the HTTP side is covered by client.test.ts and the back's e2e tests.
vi.mock('../api/files.ts')

describe('HomePage — upload (US01)', () => {
  const token = fakeJwt(3600)
  const file = new File(['contenu'], 'rapport.pdf', { type: 'application/pdf' })

  beforeEach(() => {
    vi.mocked(uploadFile).mockReset()
  })

  /** Logged-in user who has picked `chosen` with the round button. */
  const pick = async (chosen: File) => {
    saveSession({ accessToken: token, user: { id: 'u1', email: 'alice@test.fr' } })
    renderWithProviders(<HomePage />, { path: '/' })
    const user = userEvent.setup()
    await user.upload(screen.getByLabelText('Fichier à téléverser'), chosen)
    return user
  }

  it('sends a visitor to the login page, to come back afterwards', async () => {
    renderWithProviders(<HomePage />, { path: '/' })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Téléverser un fichier' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/login')
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
})

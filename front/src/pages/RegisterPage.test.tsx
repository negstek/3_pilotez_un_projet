import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerUser } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { fakeJwt } from '../test/jwt.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { RegisterPage } from './RegisterPage.tsx'

// Same approach as LoginPage.test.tsx: the API module is mocked.
vi.mock('../api/auth.ts')

describe('RegisterPage (US03)', () => {
  beforeEach(() => {
    vi.mocked(registerUser).mockReset()
  })

  const fill = async (email: string, password: string, confirmation: string) => {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), email)
    await user.type(screen.getByLabelText('Mot de passe'), password)
    await user.type(screen.getByLabelText('Vérification du mot de passe'), confirmation)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
  }

  it('rejects a password shorter than 8 characters', async () => {
    renderWithProviders(<RegisterPage />, { route: '/register', path: '/register' })

    await fill('alice@test.fr', 'court', 'court')

    expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription('Le mot de passe doit contenir au moins 8 caractères')
    expect(registerUser).not.toHaveBeenCalled()
  })

  it('rejects a confirmation that differs from the password', async () => {
    renderWithProviders(<RegisterPage />, { route: '/register', path: '/register' })

    await fill('alice@test.fr', 'motdepasse', 'motdepasse2')

    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    expect(registerUser).not.toHaveBeenCalled()
  })

  it('creates the account without sending the confirmation, then logs the user in', async () => {
    vi.mocked(registerUser).mockResolvedValue({
      accessToken: fakeJwt(3600),
      user: { id: 'u1', email: 'alice@test.fr' },
    })
    renderWithProviders(<RegisterPage />, { route: '/register', path: '/register' })

    await fill('alice@test.fr', 'motdepasse', 'motdepasse')

    expect(registerUser).toHaveBeenCalledWith({
      email: 'alice@test.fr',
      password: 'motdepasse',
    })
    expect(await screen.findByTestId('location')).toHaveTextContent('/mon-espace')
  })

  it('shows the API error when the email is already taken', async () => {
    vi.mocked(registerUser).mockRejectedValue(new ApiError(409, 'Cet email est déjà utilisé'))
    renderWithProviders(<RegisterPage />, { route: '/register', path: '/register' })

    await fill('alice@test.fr', 'motdepasse', 'motdepasse')

    expect(await screen.findByRole('alert')).toHaveTextContent('Cet email est déjà utilisé')
  })
})

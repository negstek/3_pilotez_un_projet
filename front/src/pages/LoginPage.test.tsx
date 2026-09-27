import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loginUser } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { STORAGE_KEY } from '../auth/session.ts'
import { fakeJwt } from '../test/jwt.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { LoginPage } from './LoginPage.tsx'

// The API module is replaced by automatic mocks: these tests cover the screen's behavior, not HTTP (covered by client.test.ts and the
// back's e2e tests).
vi.mock('../api/auth.ts')

describe('LoginPage (US04)', () => {
  beforeEach(() => {
    vi.mocked(loginUser).mockReset()
  })

  const fill = async (email: string, password: string) => {
    const user = userEvent.setup()
    if (email) await user.type(screen.getByLabelText('Email'), email)
    if (password) await user.type(screen.getByLabelText('Mot de passe'), password)
    await user.click(screen.getByRole('button', { name: 'Connexion' }))
  }

  it('shows input errors without calling the API', async () => {
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' })

    await fill('alice', '')

    expect(screen.getByText("Le format de l'email est invalide")).toBeInTheDocument()
    expect(screen.getByText('Le mot de passe est requis')).toBeInTheDocument()
    expect(loginUser).not.toHaveBeenCalled()
  })

  it('logs the user in then sends them to their space', async () => {
    const session = {
      accessToken: fakeJwt(3600),
      user: { id: 'u1', email: 'alice@test.fr' },
    }
    vi.mocked(loginUser).mockResolvedValue(session)
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' })

    await fill('alice@test.fr', 'motdepasse')

    expect(loginUser).toHaveBeenCalledWith({
      email: 'alice@test.fr',
      password: 'motdepasse',
    })
    expect(await screen.findByTestId('location')).toHaveTextContent('/mon-espace')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(session)
  })

  it('shows the API message when the credentials are rejected', async () => {
    vi.mocked(loginUser).mockRejectedValue(new ApiError(401, 'Email ou mot de passe incorrect'))
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' })

    await fill('alice@test.fr', 'mauvais')

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou mot de passe incorrect')
    expect(screen.getByRole('button', { name: 'Connexion' })).toBeEnabled()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

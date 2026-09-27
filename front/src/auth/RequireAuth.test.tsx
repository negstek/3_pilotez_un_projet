import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeJwt } from '../test/jwt.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { RequireAuth } from './RequireAuth.tsx'
import { saveSession } from './session.ts'

const protectedPage = (
  <RequireAuth>
    <p>Contenu privé</p>
  </RequireAuth>
)

describe('RequireAuth', () => {
  it('redirects a visitor who is not logged in to the login page', () => {
    renderWithProviders(protectedPage, { route: '/mon-espace', path: '/mon-espace' })

    expect(screen.queryByText('Contenu privé')).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it('renders the page for a logged-in user', () => {
    saveSession({ accessToken: fakeJwt(3600), user: { id: 'u1', email: 'a@test.fr' } })
    renderWithProviders(protectedPage, { route: '/mon-espace', path: '/mon-espace' })

    expect(screen.getByText('Contenu privé')).toBeInTheDocument()
  })

  it('treats an expired token as not logged in', () => {
    saveSession({ accessToken: fakeJwt(-1), user: { id: 'u1', email: 'a@test.fr' } })
    renderWithProviders(protectedPage, { route: '/mon-espace', path: '/mon-espace' })

    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })
})

import { newAccount, registerByApi } from '../support/account.ts'

describe('Login (US04)', () => {
  it('logs an existing user in and opens the personal space', () => {
    const account = newAccount()
    registerByApi(account)

    // Reached through the personal space, as a visitor would: the protected route sends them to the login screen first.
    cy.visit('/mon-espace')
    cy.location('pathname').should('eq', '/login')
    cy.get('input[name=email]').type(account.email)
    cy.get('input[name=password]').type(account.password)
    cy.contains('button', 'Connexion').click()

    cy.location('pathname').should('eq', '/mon-espace')
    cy.contains('h1', 'Mes fichiers')
    // The session survives a reload: the token is restored, the user is not sent back to the login screen.
    cy.reload()
    cy.location('pathname').should('eq', '/mon-espace')
  })
})

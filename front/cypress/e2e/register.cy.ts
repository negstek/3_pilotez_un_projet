import { newAccount } from '../support/account.ts'

describe('Sign-up (US03)', () => {
  it('creates an account and opens the personal space', () => {
    const account = newAccount()

    cy.visit('/register')
    cy.get('input[name=email]').type(account.email)
    cy.get('input[name=password]').type(account.password)
    cy.get('input[name=confirmation]').type(account.password)
    cy.contains('button', 'Créer mon compte').click()

    // The new user is logged in right away and lands on their (empty) personal space.
    cy.location('pathname').should('eq', '/mon-espace')
    cy.contains('h1', 'Mes fichiers')
  })
})

import type { AuthResponse } from '@datashare/shared-lib'

export interface Account {
  email: string
  password: string
}

/**
 * Credentials of an account that does not exist yet. The email is unique at each call, so the scenarios never depend on the content of the
 * test database nor on each other, and the database does not have to be emptied between them.
 */
export function newAccount(): Account {
  return { email: `cypress-${Date.now()}-${Cypress._.random(1e6)}@example.com`, password: 'e2e-password' }
}

/** Creates the account directly through the API, for the scenarios in which signing up is not what is being tested. */
export function registerByApi(account: Account): Cypress.Chainable<AuthResponse> {
  return cy.request<AuthResponse>('POST', '/api/auth/register', account).its('body')
}

import { newAccount, registerByApi } from '../support/account.ts'

// Same key as STORAGE_KEY in src/auth/session.ts.
const SESSION_KEY = 'datashare.session'

describe('Upload, then download through the link (US01 / US02)', () => {
  it('uploads a file, then downloads it without an account through the link obtained', () => {
    const fileName = 'report-e2e.txt'
    const content = `Content of the test file, accents included: é à ç (${Date.now()})`

    // Logged in without going through the form, which login.cy.ts already covers.
    registerByApi(newAccount()).then((session) => {
      cy.visit('/', { onBeforeLoad: (win) => win.localStorage.setItem(SESSION_KEY, JSON.stringify(session)) })
    })
    cy.contains('a', 'Mon espace')

    // The native picker is hidden behind the round button, hence `force`.
    cy.get('input[type=file]').selectFile({ contents: Cypress.Buffer.from(content), fileName, mimeType: 'text/plain' }, { force: true })
    cy.contains('.file-info', fileName)
    cy.contains('button', 'Téléverser').click()
    cy.contains('Félicitations, ton fichier sera conservé chez nous pendant une semaine !')

    cy.get('.upload-success__link')
      .should('have.attr', 'href')
      .and('match', /\/f\/[0-9a-f-]{36}$/)
      .then((link) => {
        // The link is public: it is opened as a visitor, once the session is forgotten.
        cy.clearLocalStorage()
        cy.visit(String(link))
      })
    cy.contains('a', 'Se connecter')
    cy.contains('.file-info', fileName)
    cy.contains('button', 'Télécharger').click()

    cy.readFile(`${Cypress.config('downloadsFolder')}/${fileName}`).should('eq', content)
  })
})

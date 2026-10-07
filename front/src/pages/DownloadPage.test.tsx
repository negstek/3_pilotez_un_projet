import type { FilePublicMetadata } from '@datashare/shared-lib'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { DownloadPage } from './DownloadPage.tsx'

// Unlike the other screens (vi.mock of src/api/), this one is tested with MSW, which intercepts the requests at the network level: the real
// client code (URL, body, reading of the status codes) runs against the responses of docs/api-contract.yaml. See the note on API mocking
// in front tests, docs/architecture.md.

const DAY_MS = 24 * 60 * 60 * 1000
const content = 'contenu du fichier'

/** Body of GET /f/{token}: unprotected PDF of 2.6 MB, expiring in 3 days, unless overridden. */
const metadata = (overrides: Partial<FilePublicMetadata> = {}): FilePublicMetadata => ({
  originalName: 'rapport.pdf',
  sizeBytes: 2_726_297,
  mimeType: 'application/pdf',
  expiresAt: new Date(Date.now() + 3 * DAY_MS).toISOString(),
  passwordProtected: false,
  ...overrides,
})

/** Error body of the API (contract's `Error` schema). */
const apiError = (statusCode: number, message: string) => HttpResponse.json({ statusCode, message }, { status: statusCode })
/** A function, not a constant: the body of a Response can only be read once. */
const expired = () => apiError(410, "Ce fichier n'est plus disponible en téléchargement car il a expiré")

/** GET /f/{token}: metadata of the link "abc". `*` matches the API base URL, whatever VITE_API_URL is. */
const metadataHandler = (response: () => Response) => http.get('*/f/abc', response)

/** POST /f/{token}/download: protected by "secret1" when `protectedBy` is set, as the back does. */
const downloadHandler = (protectedBy?: string) =>
  http.post('*/f/abc/download', async ({ request }) => {
    const { password } = (await request.json()) as { password?: string }
    if (protectedBy && !password) return apiError(422, 'Le mot de passe est requis pour télécharger ce fichier')
    if (protectedBy && password !== protectedBy) return apiError(401, 'Mot de passe incorrect')
    return new HttpResponse(content, { headers: { 'Content-Type': 'application/octet-stream' } })
  })

const server = setupServer()

describe('DownloadPage (US02) — API simulated with MSW', () => {
  // Any request without a handler fails the test: the screen must only call the routes of the contract.
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => {
    server.resetHandlers()
    vi.restoreAllMocks()
  })
  afterAll(() => server.close())

  /** Files the page asked the browser to save, in order: name given to the link and downloaded content. */
  let saved: { name: string; blob: Blob }[]

  beforeEach(() => {
    // jsdom has no object URLs nor real downloads: records what the page hands to the browser instead.
    saved = []
    let lastBlob: Blob
    URL.createObjectURL = vi.fn((blob: Blob) => {
      lastBlob = blob
      return 'blob:fichier'
    })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ name: this.download, blob: lastBlob })
    })
  })

  /** Opens the shared link /f/abc, matched by the same route pattern as App. */
  const renderPage = () => renderWithProviders(<DownloadPage />, { route: '/f/abc', path: '/f/:token' })

  it('200: shows the metadata, then downloads the file under its original name', async () => {
    server.use(
      metadataHandler(() => HttpResponse.json(metadata())),
      downloadHandler(),
    )
    renderPage()

    expect(await screen.findByText('rapport.pdf')).toBeInTheDocument()
    expect(screen.getByText(/2,6/)).toBeInTheDocument()
    expect(screen.getByText('Ce fichier expirera dans 3 jours.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Mot de passe')).not.toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Télécharger' }))

    await vi.waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0].name).toBe('rapport.pdf')
    expect(await saved[0].blob.text()).toBe(content)
  })

  it('warns when the file expires tomorrow', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    server.use(metadataHandler(() => HttpResponse.json(metadata({ expiresAt: tomorrow.toISOString() }))))
    renderPage()

    expect(await screen.findByText('Ce fichier expirera demain.')).toBeInTheDocument()
  })

  it('410: shows the explicit message of an expired link, without download button', async () => {
    server.use(metadataHandler(expired))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent("Ce fichier n'est plus disponible en téléchargement car il a expiré")
    expect(screen.queryByRole('button', { name: 'Télécharger' })).not.toBeInTheDocument()
  })

  it('404: shows the message of an unknown link', async () => {
    server.use(metadataHandler(() => apiError(404, "Ce lien de téléchargement n'existe pas ou le fichier a été supprimé")))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent("Ce lien de téléchargement n'existe pas ou le fichier a été supprimé")
  })

  it('protected file: the button waits for the password, 401 is shown under the field, the right password downloads', async () => {
    server.use(
      metadataHandler(() => HttpResponse.json(metadata({ passwordProtected: true }))),
      downloadHandler('secret1'),
    )
    renderPage()
    const user = userEvent.setup()

    const button = await screen.findByRole('button', { name: 'Télécharger' })
    expect(button).toBeDisabled()

    await user.type(screen.getByLabelText('Mot de passe'), 'mauvais')
    await user.click(button)
    expect(await screen.findByText('Mot de passe incorrect')).toBeInTheDocument()
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('aria-invalid', 'true')
    expect(saved).toHaveLength(0)

    await user.clear(screen.getByLabelText('Mot de passe'))
    await user.type(screen.getByLabelText('Mot de passe'), 'secret1')
    await user.click(button)
    await vi.waitFor(() => expect(saved).toHaveLength(1))
    expect(screen.queryByText('Mot de passe incorrect')).not.toBeInTheDocument()
  })

  it('422: shows the server message under the field when the password is missing', async () => {
    // The page believes the file unprotected (metadata), but the server requires a password: the 422 must still be readable.
    server.use(
      metadataHandler(() => HttpResponse.json(metadata())),
      downloadHandler('secret1'),
    )
    renderPage()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Télécharger' }))

    expect(await screen.findByText('Le mot de passe est requis pour télécharger ce fichier')).toBeInTheDocument()
  })

  it('410 on download: a link that expired after the page was opened switches to the expired screen', async () => {
    server.use(
      metadataHandler(() => HttpResponse.json(metadata())),
      http.post('*/f/abc/download', expired),
    )
    renderPage()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Télécharger' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('il a expiré')
    expect(screen.queryByText('rapport.pdf')).not.toBeInTheDocument()
  })
})

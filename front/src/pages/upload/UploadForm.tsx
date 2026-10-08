import { EXPIRATION_DEFAULT_DAYS, EXPIRATION_MAX_DAYS, EXPIRATION_MIN_DAYS, type FileUploadResponse } from '@datashare/shared-lib'
import { useId, useState, type SubmitEvent } from 'react'
import { ApiError } from '../../api/client.ts'
import { uploadFile } from '../../api/files.ts'
import { useAuth } from '../../auth/AuthContext.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Callout } from '../../components/ui/Callout.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { FileInfo } from '../../components/ui/FileInfo.tsx'
import { Input } from '../../components/ui/Input.tsx'
import { formatDuration, formatSize } from '../../files/format.ts'
import { validateFilePassword, validateUploadFile } from '../../files/validation.ts'

/** Upload result, with the chosen duration for the success message. */
export type UploadResult = FileUploadResponse & { expiresInDays: number }

/** Options of the expiration select: every whole number of days allowed by US01, [1, 2, …, 7]. */
const DURATIONS = Array.from({ length: EXPIRATION_MAX_DAYS - EXPIRATION_MIN_DAYS + 1 }, (_, i) => EXPIRATION_MIN_DAYS + i)

interface UploadFormProps {
  file: File
  /** Opens the file picker again ("Changer" button). */
  onChangeFile: () => void
  /** Called once the API has accepted the file; the parent then replaces the form with the link (UploadSuccess). */
  onUploaded: (result: UploadResult) => void
}

/**
 * "Ajouter un fichier" card of the mockups (US01, US07): optional password and expiration, 7 days by default. A file over 1 GB or with a
 * forbidden extension is reported as soon as it is chosen, and the button stays disabled.
 *
 * Used with or without a session: the token is sent when there is one, and a visitor's upload is anonymous (US07).
 */
export function UploadForm({ file, onChangeFile, onUploaded }: Readonly<UploadFormProps>) {
  const { token } = useAuth()
  const [password, setPassword] = useState('')
  const [expiresInDays, setExpiresInDays] = useState(EXPIRATION_DEFAULT_DAYS)
  const [passwordError, setPasswordError] = useState<string>()
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const expirationId = useId()
  // Derived from the file at each render rather than stored: a new file picked with "Changer" is checked at once.
  const fileError = validateUploadFile(file)

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)
    const error = validateFilePassword(password)
    setPasswordError(error)
    if (error || fileError) return

    setSubmitting(true)
    try {
      const result = await uploadFile(file, { password, expiresInDays }, token)
      onUploaded({ ...result, expiresInDays })
    } catch (error) {
      // 401 only happens to a logged-in user whose token is no longer accepted: a visitor sends no token and is never refused for it. The
      // user is not logged out here, unlike in "Mes fichiers": retrying as a visitor would silently detach the file from their account.
      if (error instanceof ApiError && error.status === 401) {
        setServerError('Votre session a expiré : reconnectez-vous pour téléverser un fichier.')
      } else {
        setServerError(error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue.')
      }
      // Only reset on failure: on success the form is replaced by the link, and keeping the button disabled prevents a double upload.
      setSubmitting(false)
    }
  }

  return (
    <Card title="Ajouter un fichier">
      <form className="upload-form" onSubmit={onSubmit} noValidate>
        {serverError && <Callout variant="error">{serverError}</Callout>}
        <div>
          <FileInfo
            name={file.name}
            detail={formatSize(file.size)}
            invalid={fileError !== undefined}
            action={<Button onClick={onChangeFile}>Changer</Button>}
          />
          {fileError && <p className="field__error upload-form__file-error">{fileError}</p>}
        </div>
        <Input
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          placeholder="Optionnel"
          value={password}
          error={passwordError}
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className="field">
          <label className="field__label" htmlFor={expirationId}>
            Expiration
          </label>
          <select
            id={expirationId}
            className="field__input"
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(Number(event.target.value))}
          >
            {DURATIONS.map((days) => (
              <option key={days} value={days}>
                {/* "une journée" → "Une journée" */}
                {formatDuration(days).replace(/^./, (first) => first.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="upload-form__submit" disabled={fileError !== undefined || submitting}>
          {submitting ? 'Téléversement…' : 'Téléverser'}
        </Button>
      </form>
    </Card>
  )
}

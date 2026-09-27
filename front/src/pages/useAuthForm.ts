import { useState, type SubmitEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ApiError } from '../api/client.ts'

/** Error message per field; a missing or undefined entry means "valid". */
type Errors<F extends string> = Partial<Record<F, string>>

/**
 * Logic shared by the login and sign-up forms: client-side validation, submission, display of the server error and redirection on success.
 *
 * @param initial Initial value of each field; its keys define the fields.
 * @param validate Returns the error of each field (undefined when valid).
 * @param submit Sends the form; rejects with ApiError on failure.
 */
export function useAuthForm<F extends string>(
  initial: Record<F, string>,
  validate: (values: Record<F, string>) => Errors<F>,
  submit: (values: Record<F, string>) => Promise<void>,
) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Errors<F>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  /** Props to spread on an <Input>: value, change handler and error. */
  const fieldProps = (field: F) => ({
    name: field,
    value: values[field],
    error: errors[field],
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [field]: event.target.value })),
  })

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)
    const validationErrors = validate(values)
    setErrors(validationErrors)
    // Invalid input never reaches the API.
    if (Object.values(validationErrors).some(Boolean)) return

    setSubmitting(true)
    try {
      await submit(values)
      // Back to the page that required authentication (set by RequireAuth), otherwise to the personal space. `replace` so that "back" does
      // not return to the form.
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? '/mon-espace', { replace: true })
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue.')
      // Only reset on failure: on success the component unmounts with the navigation, and keeping the button disabled prevents a double
      // submit.
      setSubmitting(false)
    }
  }

  return { fieldProps, onSubmit, serverError, submitting }
}

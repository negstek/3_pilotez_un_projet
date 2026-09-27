import { useId, type InputHTMLAttributes } from 'react'
import './ui.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visible label, linked to the field (clicking it focuses the input). */
  label: string
  /** Validation message shown under the field; marks the field as invalid. */
  error?: string
}

/**
 * Labelled text field with an optional error message. Accessibility: the label is tied to the input through `htmlFor`, and the error is
 * exposed with aria-invalid and aria-describedby so screen readers read it with the field.
 */
export function Input({ label, error, id, ...props }: Readonly<InputProps>) {
  // useId() gives a unique, stable id, so several Inputs can share a page without the caller having to name them.
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  )
}

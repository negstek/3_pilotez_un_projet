import type { ButtonHTMLAttributes } from 'react'
import './ui.css'

/** Visual variants found in the mockups (docs/maquette/Components.png). */
type Variant = 'primary' | 'dark' | 'link'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** Takes the full width of its container (form submit buttons). */
  block?: boolean
}

/**
 * Shared button. Accepts every native <button> attribute; `type` defaults to "button" (instead of the HTML default "submit") so that a
 * button placed in a form never submits it by accident. Submit buttons opt in with type="submit".
 */
export function Button({ variant = 'primary', block = false, type = 'button', className, ...props }: Readonly<ButtonProps>) {
  const classes = ['btn', `btn--${variant}`, block && 'btn--block', className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...props} />
}

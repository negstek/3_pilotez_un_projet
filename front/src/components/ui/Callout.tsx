import type { ReactNode } from 'react'
import './ui.css'

type Variant = 'info' | 'warning' | 'error'

// Text glyphs rather than an icon library, to keep the MVP dependency-free.
const ICONS: Record<Variant, string> = { info: 'ⓘ', warning: '⚠', error: '⊘' }

/**
 * Information / warning / error banner. Errors use role="alert" so screen readers announce them immediately (e.g. a login failure); other
 * variants are an <output>, whose implicit role is the politer "status".
 */
export function Callout({ variant = 'info', children }: Readonly<{ variant?: Variant; children: ReactNode }>) {
  const className = `callout callout--${variant}`
  // Decorative: the meaning is carried by the text and the role.
  const icon = <span aria-hidden="true">{ICONS[variant]}</span>

  return variant === 'error' ? (
    <p className={className} role="alert">
      {icon}
      {children}
    </p>
  ) : (
    <output className={className}>
      {icon}
      {children}
    </output>
  )
}

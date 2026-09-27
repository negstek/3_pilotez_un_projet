import type { ReactNode } from 'react'
import './ui.css'

/**
 * White card with a centered title, used by the form screens. The title is the page's <h1>: each screen shows a single card.
 */
export function Card({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="card">
      <h1 className="card__title">{title}</h1>
      {children}
    </section>
  )
}

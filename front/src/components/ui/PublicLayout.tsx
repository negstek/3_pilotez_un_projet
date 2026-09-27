import type { ReactNode } from 'react'
import { Header } from './Header.tsx'
import './ui.css'

/**
 * Page frame of the public screens (gradient background, header, footer), as in the mockups. The content is centered in the remaining
 * height.
 */
export function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="public-layout">
      <Header />
      <main className="public-layout__main">{children}</main>
      <footer className="public-layout__footer">Copyright DataShare® 2025</footer>
    </div>
  )
}

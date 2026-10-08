import { useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext.tsx'
import { Button } from '../../components/ui/Button.tsx'

/**
 * Frame of the personal space in the "Mon espace" mockup: a gradient sidebar with the navigation, and a top bar with the actions. Only this
 * screen uses it, so it stays local (see the note on reusable UI components in docs/architecture.md). On a narrow screen, the sidebar
 * becomes a drawer opened by the menu button, as in the mobile mockup.
 */
export function MyFilesLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="my-files-layout">
      <aside
        id="my-files-menu"
        className={menuOpen ? 'my-files-layout__sidebar my-files-layout__sidebar--open' : 'my-files-layout__sidebar'}
      >
        <div className="my-files-layout__brand-row">
          <Link to="/" className="my-files-layout__brand">
            DataShare
          </Link>
          {/* Drawer only: hidden on wide screens, where the sidebar is always visible. */}
          <button type="button" className="my-files-layout__close" aria-label="Fermer le menu" onClick={closeMenu}>
            ×
          </button>
        </div>
        <nav aria-label="Espace personnel">
          <NavLink to="/mon-espace" className="my-files-layout__nav-link" onClick={closeMenu}>
            Mes fichiers
          </NavLink>
        </nav>
        <p className="my-files-layout__footer">Copyright DataShare® 2025</p>
      </aside>
      <div className="my-files-layout__content">
        <header className="my-files-layout__topbar">
          <button
            type="button"
            className="my-files-layout__menu"
            aria-label="Ouvrir le menu"
            aria-controls="my-files-menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <div className="my-files-layout__actions">
            {/* Navigation, hence a link styled as a button (see Header). */}
            <Link to="/" className="btn btn--dark">
              Ajouter des fichiers
            </Link>
            <Button
              variant="link"
              onClick={() => {
                logout()
                navigate('/')
              }}
            >
              Déconnexion
            </Button>
          </div>
        </header>
        <main className="my-files-layout__main">{children}</main>
      </div>
    </div>
  )
}

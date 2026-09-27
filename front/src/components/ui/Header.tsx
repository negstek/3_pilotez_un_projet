import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext.tsx'
import './ui.css'

/**
 * Top bar of the public screens. The action depends on the session: "Se connecter" for visitors, "Mon espace" for logged-in users.
 */
export function Header() {
  const { user } = useAuth()

  return (
    <header className="header">
      <Link to="/" className="header__brand">
        DataShare
      </Link>
      {/* A link styled as a button, not a <button> with navigate(): it is navigation, so middle-click, "open in new tab" and the "link"
          role announced by screen readers must keep working. */}
      <Link to={user ? '/mon-espace' : '/login'} className="btn btn--dark">
        {user ? 'Mon espace' : 'Se connecter'}
      </Link>
    </header>
  )
}

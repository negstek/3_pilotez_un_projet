import { PublicLayout } from '../components/ui/PublicLayout.tsx'
import './pages.css'

/** Home screen of the mockups ("Tu veux partager un fichier ?"). */
export function HomePage() {
  return (
    <PublicLayout>
      <h1 className="home__title">Tu veux partager un fichier ?</h1>
      {/* Upload (US01 / US07) is not implemented yet: the button is shown as in the mockup but disabled, with an explicit label for
          screen readers. */}
      <button
        type="button"
        className="home__upload"
        disabled
        aria-label="Téléverser un fichier (bientôt disponible)"
        title="Bientôt disponible"
      >
        <span aria-hidden="true">⇪</span>
      </button>
    </PublicLayout>
  )
}

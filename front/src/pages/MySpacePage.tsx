import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { PublicLayout } from '../components/ui/PublicLayout.tsx'
import './pages.css'

// Temporary screen proving that authentication works end to end; the "Mes fichiers" space (US05 / US06) will replace it.
export function MySpacePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <PublicLayout>
      <Card title="Mon espace">
        <div className="my-space">
          <p>
            Connecté en tant que <strong>{user?.email}</strong>
          </p>
          <Button
            variant="dark"
            onClick={() => {
              logout()
              navigate('/')
            }}
          >
            Déconnexion
          </Button>
        </div>
      </Card>
    </PublicLayout>
  )
}

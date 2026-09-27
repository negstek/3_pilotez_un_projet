import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext.tsx'
import { validateEmail, validateRequiredPassword } from '../auth/validation.ts'
import { Button } from '../components/ui/Button.tsx'
import { Callout } from '../components/ui/Callout.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Input } from '../components/ui/Input.tsx'
import { PublicLayout } from '../components/ui/PublicLayout.tsx'
import { useAuthForm } from './useAuthForm.ts'
import './pages.css'

export function LoginPage() {
  const { login } = useAuth()
  const { fieldProps, onSubmit, serverError, submitting } = useAuthForm(
    { email: '', password: '' },
    ({ email, password }) => ({
      email: validateEmail(email),
      password: validateRequiredPassword(password),
    }),
    login,
  )

  return (
    <PublicLayout>
      <Card title="Connexion">
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          {serverError && <Callout variant="error">{serverError}</Callout>}
          <Input label="Email" type="email" autoComplete="email" placeholder="Saisissez votre email..." {...fieldProps('email')} />
          <Input
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            placeholder="Saisissez votre mot de passe..."
            {...fieldProps('password')}
          />
          <Link to="/register" className="auth-form__switch">
            Créer un compte
          </Link>
          <Button type="submit" block disabled={submitting}>
            Connexion
          </Button>
        </form>
      </Card>
    </PublicLayout>
  )
}

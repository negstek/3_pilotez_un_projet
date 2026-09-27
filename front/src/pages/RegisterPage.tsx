import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext.tsx'
import { validateEmail, validateNewPassword, validatePasswordConfirmation } from '../auth/validation.ts'
import { Button } from '../components/ui/Button.tsx'
import { Callout } from '../components/ui/Callout.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Input } from '../components/ui/Input.tsx'
import { PublicLayout } from '../components/ui/PublicLayout.tsx'
import { useAuthForm } from './useAuthForm.ts'
import './pages.css'

export function RegisterPage() {
  const { register } = useAuth()
  const { fieldProps, onSubmit, serverError, submitting } = useAuthForm(
    { email: '', password: '', confirmation: '' },
    ({ email, password, confirmation }) => ({
      email: validateEmail(email),
      password: validateNewPassword(password),
      confirmation: validatePasswordConfirmation(password, confirmation),
    }),
    ({ email, password }) => register({ email, password }),
  )

  return (
    <PublicLayout>
      <Card title="Créer un compte">
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          {serverError && <Callout variant="error">{serverError}</Callout>}
          <Input label="Email" type="email" autoComplete="email" placeholder="Saisissez votre email..." {...fieldProps('email')} />
          <Input
            label="Mot de passe"
            type="password"
            autoComplete="new-password"
            placeholder="Saisissez votre mot de passe..."
            {...fieldProps('password')}
          />
          <Input
            label="Vérification du mot de passe"
            type="password"
            autoComplete="new-password"
            placeholder="Saisissez-le à nouveau"
            {...fieldProps('confirmation')}
          />
          <Link to="/login" className="auth-form__switch">
            J'ai déjà un compte
          </Link>
          <Button type="submit" block disabled={submitting}>
            Créer mon compte
          </Button>
        </form>
      </Card>
    </PublicLayout>
  )
}

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button.tsx'

describe('Button', () => {
  it('does not trigger its action when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Connexion
      </Button>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Connexion' }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not submit a form by default (type="button")', () => {
    render(<Button>Annuler</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
})

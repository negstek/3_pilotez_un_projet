import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button.tsx'
import { FileInfo } from './FileInfo.tsx'

describe('FileInfo', () => {
  const longName = 'IMG_9210_1231231313132132313213231313213.jpg'

  it('keeps the full name in a tooltip, since a long name is cut with an ellipsis', () => {
    render(<FileInfo name={longName} detail="2,6 Mo" />)

    expect(screen.getByText(longName)).toHaveAttribute('title', longName)
    expect(screen.getByText('2,6 Mo')).not.toHaveClass('file-info__detail--invalid')
  })

  it('shows the detail as an error when the file is invalid (over 1 GB)', () => {
    render(<FileInfo name="video.mp4" detail="3,7 Go" invalid />)

    expect(screen.getByText('3,7 Go')).toHaveClass('file-info__detail--invalid')
  })

  it('renders the action next to the file', async () => {
    const onChange = vi.fn()
    render(<FileInfo name="rapport.pdf" detail="2,6 Mo" action={<Button onClick={onChange}>Changer</Button>} />)

    await userEvent.click(screen.getByRole('button', { name: 'Changer' }))

    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

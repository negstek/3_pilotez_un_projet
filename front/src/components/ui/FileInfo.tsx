import type { ReactNode } from 'react'
import './ui.css'

interface FileInfoProps {
  name: string
  /** Line under the name: size, expiry date… */
  detail: ReactNode
  /** Shows the detail as an error (file over 1 GB in the upload mockup). */
  invalid?: boolean
  /** Action on the right, e.g. the "Changer" button of the upload form. */
  action?: ReactNode
}

/**
 * File line of the mockups: document icon, name cut with an ellipsis when too long (the full name stays in a tooltip), and a detail line.
 * Used by the upload and download screens, then by the history (US05).
 */
export function FileInfo({ name, detail, invalid = false, action }: Readonly<FileInfoProps>) {
  return (
    <div className="file-info">
      <svg className="file-info__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5" />
      </svg>
      <div className="file-info__text">
        <p className="file-info__name" title={name}>
          {name}
        </p>
        <p className={invalid ? 'file-info__detail file-info__detail--invalid' : 'file-info__detail'}>{detail}</p>
      </div>
      {action}
    </div>
  )
}

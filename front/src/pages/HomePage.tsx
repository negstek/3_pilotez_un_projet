import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext.tsx'
import { PublicLayout } from '../components/ui/PublicLayout.tsx'
import { UploadForm, type UploadResult } from './upload/UploadForm.tsx'
import { UploadSuccess } from './upload/UploadSuccess.tsx'
import './pages.css'

/**
 * Home screen and upload flow of the mockups (US01): the round button opens the file picker, then the "Ajouter un fichier" card replaces
 * the invitation, and finally shows the link to share.
 */
export function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)

  const pickFile = () => {
    // US01 is reserved to logged-in users (anonymous upload comes with US07): visitors log in first, then come back here.
    if (!user) {
      navigate('/login', { state: { from: '/' } })
      return
    }
    inputRef.current?.click()
  }

  const onFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0]
    // Reset, so that choosing the same file again (after "Changer") still triggers a change.
    event.target.value = ''
    if (chosen) {
      setFile(chosen)
      setResult(null)
    }
  }

  // Three successive states of the screen: invitation (no file yet), form (file chosen), link to share (upload done).
  let content
  if (!file) {
    content = (
      <>
        <h1 className="home__title">Tu veux partager un fichier ?</h1>
        <button type="button" className="home__upload" aria-label="Téléverser un fichier" onClick={pickFile}>
          <span aria-hidden="true">⇪</span>
        </button>
      </>
    )
  } else if (result) {
    content = <UploadSuccess file={file} result={result} />
  } else {
    content = <UploadForm file={file} onChangeFile={pickFile} onUploaded={setResult} />
  }

  return (
    <PublicLayout>
      {/* Hidden native picker, opened by the round button and by "Changer". */}
      <input ref={inputRef} type="file" hidden aria-label="Fichier à téléverser" onChange={onFileChosen} />
      {content}
    </PublicLayout>
  )
}

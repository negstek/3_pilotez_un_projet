import { useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { FileInfo } from '../../components/ui/FileInfo.tsx'
import { formatDuration, formatSize } from '../../files/format.ts'
import type { UploadResult } from './UploadForm.tsx'

type CopyState = 'idle' | 'copied' | 'failed'

const COPY_LABELS: Record<CopyState, string> = {
  idle: 'Copier le lien',
  copied: 'Lien copié !',
  failed: 'Copie impossible : sélectionnez le lien',
}

/** Last state of the upload card (US01): the link to share and a button copying it. */
export function UploadSuccess({ file, result }: Readonly<{ file: File; result: UploadResult }>) {
  const [copy, setCopy] = useState<CopyState>('idle')

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(result.downloadUrl)
      setCopy('copied')
    } catch {
      // The Clipboard API is only available on secure origins (HTTPS or localhost) and can be refused by the browser.
      setCopy('failed')
    }
  }

  return (
    <Card title="Ajouter un fichier">
      <div className="upload-success">
        <FileInfo name={file.name} detail={formatSize(file.size)} />
        <p>Félicitations, ton fichier sera conservé chez nous pendant {formatDuration(result.expiresInDays)} !</p>
        <a className="upload-success__link" href={result.downloadUrl}>
          {result.downloadUrl}
        </a>
        <Button className="upload-success__copy" onClick={copyLink}>
          {COPY_LABELS[copy]}
        </Button>
      </div>
    </Card>
  )
}

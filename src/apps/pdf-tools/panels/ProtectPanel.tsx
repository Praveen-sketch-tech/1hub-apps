import { useState, useRef } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { encryptPDF, AlreadyEncryptedError } from '@pdfsmaller/pdf-encrypt-lite'

export function ProtectPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultFileName, setResultFileName] = useState('protected.pdf')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    setResultUrl(null)
    setFile(f)
  }

  async function handleProtect() {
    if (!file) return
    if (!password) {
      setError('Password daalo.')
      return
    }
    if (password !== confirmPassword) {
      setError('Dono password match nahi kar rahe.')
      return
    }
    setProcessing(true)
    setError(null)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const encrypted = await encryptPDF(bytes, password)
      const blob = new Blob([encrypted as BlobPart], { type: 'application/pdf' })
      setResultUrl(URL.createObjectURL(blob))
      setResultFileName(file.name.replace(/\.pdf$/i, '') + '-protected.pdf')
    } catch (err) {
      if (err instanceof AlreadyEncryptedError) {
        setError('Yeh PDF already password-protected hai. Pehle Unlock tab se hata lo, phir naya password lagao.')
      } else {
        setError('Protect nahi ho paya — file corrupt ho sakti hai, dobara try karo.')
      }
    } finally {
      setProcessing(false)
    }
  }

  function startOver() {
    setFile(null)
    setPassword('')
    setConfirmPassword('')
    setResultUrl(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Card>
      <div className="flex flex-col gap-5">
        <div>
          <label className="mb-1 block text-sm font-medium">PDF upload karo</label>
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFile} className="w-full text-sm" />
        </div>

        {file && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">Naya password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                placeholder="Password"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password confirm karo</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                placeholder="Password dobara"
              />
            </div>
            <Button onClick={handleProtect} disabled={processing || !password}>
              {processing ? 'Protect ho raha hai…' : 'PDF protect karo'}
            </Button>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {resultUrl && (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <p className="text-sm font-medium">PDF ab password se protected hai.</p>
            <div className="flex gap-3">
              <a href={resultUrl} download={resultFileName}>
                <Button>Download</Button>
              </a>
              <Button variant="secondary" onClick={startOver}>Naya file</Button>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500">
          Sab kuch is browser ke andar hota hai — file kabhi kisi server pe upload nahi hoti. Password yaad rakhna,
          bhool jaane par PDF wapas khol nahi paoge.
        </p>
      </div>
    </Card>
  )
}

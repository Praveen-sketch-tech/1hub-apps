import { useState, useRef } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { decryptPDF, isEncrypted } from '@pdfsmaller/pdf-decrypt'

export function UnlockPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [encryptionInfo, setEncryptionInfo] = useState<{ encrypted: boolean; algorithm?: string } | null>(null)
  const [password, setPassword] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultFileName, setResultFileName] = useState('unlocked.pdf')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    setResultUrl(null)
    setFile(f)
    try {
      const bytes = new Uint8Array(await f.arrayBuffer())
      const info = await isEncrypted(bytes)
      setEncryptionInfo(info)
      if (!info.encrypted) {
        setError('Yeh PDF already password-protected nahi hai — unlock karne ki zarurat nahi.')
      }
    } catch {
      setError('File padhne mein dikkat aayi — corrupt PDF ho sakti hai.')
    }
  }

  async function handleUnlock() {
    if (!file) return
    setProcessing(true)
    setError(null)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const decrypted = await decryptPDF(bytes, password)
      const blob = new Blob([decrypted as BlobPart], { type: 'application/pdf' })
      setResultUrl(URL.createObjectURL(blob))
      setResultFileName(file.name.replace(/\.pdf$/i, '') + '-unlocked.pdf')
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/password/i.test(message)) {
        setError('Password galat hai — dobara try karo.')
      } else {
        setError('Unlock nahi ho paya. Password check karo ya file corrupt ho sakti hai.')
      }
    } finally {
      setProcessing(false)
    }
  }

  function startOver() {
    setFile(null)
    setEncryptionInfo(null)
    setPassword('')
    setResultUrl(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Card>
      <div className="flex flex-col gap-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Password-protected PDF upload karo</label>
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFile} className="w-full text-sm" />
        </div>

        {encryptionInfo?.encrypted && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Encryption mili: {encryptionInfo.algorithm ?? 'unknown'}. Password daalo unlock karne ke liye.
          </p>
        )}

        {file && encryptionInfo?.encrypted && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">PDF ka password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                placeholder="Password"
              />
            </div>
            <Button onClick={handleUnlock} disabled={processing || !password}>
              {processing ? 'Unlock ho raha hai…' : 'Unlock karo'}
            </Button>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {resultUrl && (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <p className="text-sm font-medium">Password hata di gayi — PDF ab bina password ke khulegi.</p>
            <div className="flex gap-3">
              <a href={resultUrl} download={resultFileName}>
                <Button>Download</Button>
              </a>
              <Button variant="secondary" onClick={startOver}>Naya file</Button>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500">
          Sab kuch is browser ke andar hota hai — file kabhi kisi server pe upload nahi hoti, password bhi kahi save nahi hota.
        </p>
      </div>
    </Card>
  )
}

import { useRef, useState, type ChangeEvent } from 'react'
import { formatBytes } from '@core/utils/formatters'
import { Button } from '@shared/components/ui/Button'

interface FileUploadProps {
  accept?: string
  maxSizeMb?: number
  onFileSelected: (file: File) => void
  label?: string
}

// Generic, reusable file upload component. No OCR or processing logic here —
// this is intentionally kept dumb; feature modules (OCR, PDF, Image, etc.)
// can wrap this component when they're built.
export function FileUpload({ accept, maxSizeMb = 10, onFileSelected, label = 'Upload a file' }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ name: string; size: number; url: string | null } | null>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File is too large. Max size is ${maxSizeMb}MB.`)
      setPreview(null)
      return
    }

    setError(null)
    const url = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setPreview({ name: file.name, size: file.size, url })
    onFileSelected(file)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-brand-400 dark:border-slate-700"
        onClick={() => inputRef.current?.click()}
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {preview && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          {preview.url && <img src={preview.url} alt={preview.name} className="h-12 w-12 rounded object-cover" />}
          <div className="flex flex-col text-sm">
            <span className="font-medium">{preview.name}</span>
            <span className="text-slate-500">{formatBytes(preview.size)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

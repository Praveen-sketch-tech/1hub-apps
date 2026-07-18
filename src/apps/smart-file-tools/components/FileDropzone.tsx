import { useRef } from 'react'

interface Props {
  onFiles: (files: File[]) => void
}

export default function FileDropzone({ onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className="sft-dropzone"
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        onFiles(Array.from(e.dataTransfer.files))
      }}
    >
      <input
        ref={inputRef}
        hidden
        type="file"
        multiple
        onChange={(e) => onFiles(Array.from(e.target.files || []))}
      />
      <div className="sft-drop-icon">📁</div>
      <strong>Add files</strong>
      <span>Tap to choose or drag and drop multiple files</span>
    </div>
  )
}

import { useRef } from 'react'

interface Props {
  onFile: (file: File) => void
}

export function VideoDropzone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className="bvps-dropzone"
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const file = event.dataTransfer.files?.[0]
        if (file) onFile(file)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*,.webm"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
        }}
      />
      <strong>Drop a video here</strong>
      <span>or tap to choose a browser-supported video file</span>
    </div>
  )
}

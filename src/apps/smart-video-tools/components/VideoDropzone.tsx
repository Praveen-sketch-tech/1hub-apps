import { useRef } from 'react'

type Props = {
  onFile: (file: File) => void
  disabled?: boolean
}

export default function VideoDropzone({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={`svt-dropzone ${disabled ? 'is-disabled' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
          inputRef.current?.click()
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        if (disabled) return
        const file = event.dataTransfer.files?.[0]
        if (file?.type.startsWith('video/')) onFile(file)
      }}
    >
      <input
        ref={inputRef}
        hidden
        type="file"
        accept="video/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.currentTarget.value = ''
        }}
      />
      <div className="svt-drop-icon">🎬</div>
      <strong>Upload a video</strong>
      <span>Tap to choose or drop a video file here.</span>
      <small>Large videos can be slow on mobile because processing happens on your device.</small>
    </div>
  )
}

import type { ChangeEvent, DragEvent } from 'react'

type Props = {
  disabled?: boolean
  onFiles: (files: File[]) => void
}

export default function AudioDropzone({ disabled, onFiles }: Props) {
  const acceptFiles = (files: FileList | null) => {
    if (!files) return
    onFiles(Array.from(files).filter((file) => file.type.startsWith('audio/')))
  }

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFiles(event.target.files)
    event.target.value = ''
  }

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    if (!disabled) acceptFiles(event.dataTransfer.files)
  }

  return (
    <label
      className={`sat-dropzone${disabled ? ' is-disabled' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <input type="file" accept="audio/*" multiple disabled={disabled} onChange={onChange} />
      <span className="sat-drop-icon" aria-hidden="true">🎵</span>
      <strong>Drop audio files here</strong>
      <span>or tap to browse your device</span>
    </label>
  )
}

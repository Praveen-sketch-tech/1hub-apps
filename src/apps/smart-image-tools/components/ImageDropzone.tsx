import { useRef, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';

interface ImageDropzoneProps {
  disabled?: boolean;
  onFileSelected: (file: File) => void;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Please choose a JPG, PNG, or WebP image.';
  if (file.size > MAX_FILE_SIZE) return 'Maximum file size is 25 MB.';
  return null;
}

export default function ImageDropzone({ disabled, onFileSelected }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file?: File): void => {
    if (file) onFileSelected(file);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    handleFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    if (!disabled) handleFile(event.dataTransfer.files?.[0]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div
      className="sit-dropzone"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={handleKeyDown}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        disabled={disabled}
        onChange={handleChange}
      />
      <div className="sit-dropzone__icon" aria-hidden="true">↥</div>
      <strong>Drop an image here</strong>
      <span>or click to browse · JPG, PNG, WebP · up to 25 MB</span>
    </div>
  );
}

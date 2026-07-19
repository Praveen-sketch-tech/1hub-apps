import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react';

interface PdfDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  compact?: boolean;
  label?: string;
}

const ACCEPT = '.pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

/**
 * Drag-and-drop + click-to-browse upload target. Used both on the initial
 * home state and as the "add more files" control inside an active workspace.
 */
export default function PdfDropzone({ onFilesSelected, compact = false, label }: PdfDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length > 0) onFilesSelected(files);
    },
    [onFilesSelected]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) onFilesSelected(files);
      e.target.value = '';
    },
    [onFilesSelected]
  );

  return (
    <div
      className={`spt-dropzone ${isDragOver ? 'spt-dropzone--active' : ''} ${compact ? 'spt-dropzone--compact' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label={label ?? 'Upload PDF or image files'}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="spt-visually-hidden"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="spt-dropzone__icon" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="spt-dropzone__title">{label ?? 'Drop PDFs or images here'}</p>
      {!compact && <p className="spt-dropzone__hint">or click to browse — PDF, JPG, PNG, WebP</p>}
    </div>
  );
}

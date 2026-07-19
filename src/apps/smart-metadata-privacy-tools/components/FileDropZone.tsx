import React, { useCallback, useRef, useState } from 'react';

interface FileDropZoneProps {
  onFileSelected: (file: File) => void;
  accept?: string;
}

const FileDropZone: React.FC<FileDropZoneProps> = ({ onFileSelected, accept }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isActive, setIsActive] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  return (
    <div
      className={`smpt-dropzone${isActive ? ' smpt-dropzone--active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsActive(true);
      }}
      onDragLeave={() => setIsActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsActive(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <p className="smpt-dropzone__title">Drop a file here or click to choose</p>
      <p className="smpt-dropzone__hint">
        Images (JPG, PNG, WebP), PDF, audio, or video. Processed entirely in your browser — nothing is uploaded.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="smpt-dropzone__input"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};

export default FileDropZone;

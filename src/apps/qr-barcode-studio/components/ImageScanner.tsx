// App #003 — QR & Barcode Studio
// Upload-an-image scanner. Decoding happens fully client-side; the image
// is never uploaded anywhere.

import React, { useRef, useState, FC } from 'react';
import { decodeFromImageFile } from '../lib/scanner';
import type { ScanOutcome } from '../types';
import { track } from '../lib/analytics';

interface ImageScannerProps {
  onResult: (outcome: ScanOutcome) => void;
}

const ImageScanner: FC<ImageScannerProps> = ({ onResult }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      setErrorMessage('Please upload a JPG, PNG, or WebP image.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    try {
      const outcome = await decodeFromImageFile(file);
      onResult(outcome);
      track(outcome.format === 'QR Code' ? 'qr_scanned' : 'barcode_scanned', {
        source: 'image',
        format: outcome.format,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not decode the selected image.');
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <div
        className="qbs-dropzone"
        role="button"
        tabIndex={0}
        aria-label="Upload an image to scan"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        {isProcessing ? 'Scanning image…' : 'Click to upload a JPG, PNG, or WebP image'}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {errorMessage && (
        <div className="qbs-error" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default ImageScanner;

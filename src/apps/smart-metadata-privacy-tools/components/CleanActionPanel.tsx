import React, { useState } from 'react';
import type { CleaningSupport, CleanResult, ImageOutputFormat, SupportedCategory } from '../lib/types';
import { cleanFile } from '../lib/metadata';
import { downloadBlob } from '../lib/download';
import { formatBytes } from '../lib/fileInfo';

interface CleanActionPanelProps {
  file: File;
  category: SupportedCategory;
  cleaning: CleaningSupport;
}

const isImageCategory = (category: SupportedCategory) =>
  category === 'image-jpeg' || category === 'image-png' || category === 'image-webp' || category === 'image-other';

const CleanActionPanel: React.FC<CleanActionPanelProps> = ({ file, category, cleaning }) => {
  const [outputFormat, setOutputFormat] = useState<ImageOutputFormat>(
    category === 'image-png' ? 'image/png' : category === 'image-webp' ? 'image/webp' : 'image/jpeg',
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CleanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!cleaning.supported) {
    return (
      <div className="smpt-card">
        <p className="smpt-section-title">Remove Metadata</p>
        <p className="smpt-note">{cleaning.reason}</p>
      </div>
    );
  }

  const handleClean = async () => {
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const cleanResult = await cleanFile(
        file,
        isImageCategory(category) ? { imageOutputFormat: outputFormat } : undefined,
      );
      setResult(cleanResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong while cleaning this file.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="smpt-card">
      <p className="smpt-section-title">Remove Metadata</p>

      <div className="smpt-actions">
        {isImageCategory(category) && (
          <select
            className="smpt-select"
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value as ImageOutputFormat)}
            disabled={isProcessing}
            aria-label="Output format"
          >
            <option value="image/jpeg">Output: JPG</option>
            <option value="image/png">Output: PNG</option>
            <option value="image/webp">Output: WebP</option>
          </select>
        )}
        <button className="smpt-btn smpt-btn--primary" onClick={handleClean} disabled={isProcessing}>
          {isProcessing ? 'Cleaning…' : 'Remove Metadata'}
        </button>
        {result && (
          <button className="smpt-btn" onClick={() => downloadBlob(result.blob, result.fileName)}>
            Download Clean Copy
          </button>
        )}
      </div>

      {error && <p className="smpt-error" style={{ marginTop: '0.75rem' }}>{error}</p>}

      {result && (
        <div className="smpt-clean-result">
          <dl className="smpt-grid-two">
            <dt>Original format</dt>
            <dd>{result.originalFormat}</dd>
            <dt>Output format</dt>
            <dd>{result.outputFormat}</dd>
            <dt>Original size</dt>
            <dd>{formatBytes(result.originalSize)}</dd>
            <dt>Cleaned size</dt>
            <dd>{formatBytes(result.cleanedSize)}</dd>
          </dl>
          <p className="smpt-note">{result.note}</p>
        </div>
      )}
    </div>
  );
};

export default CleanActionPanel;

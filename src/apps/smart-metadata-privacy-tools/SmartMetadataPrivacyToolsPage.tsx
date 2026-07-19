import React, { useEffect, useState } from 'react';
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader';
import FileDropZone from './components/FileDropZone';
import MetadataTable from './components/MetadataTable';
import PrivacyRiskPanel from './components/PrivacyRiskPanel';
import CleanActionPanel from './components/CleanActionPanel';
import ReportActions from './components/ReportActions';
import { inspectFile } from './lib/metadata';
import { formatBytes, formatDate } from './lib/fileInfo';
import type { InspectionResult } from './lib/types';
import './smart-metadata-privacy-tools.css';

const SmartMetadataPrivacyToolsPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setResult(null);

    inspectFile(file)
      .then((inspection) => {
        if (!cancelled) setResult(inspection);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'This file could not be inspected.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="tool-page smpt-app">
      <ToolAppHeader
        appNumber="013"
        title="Smart Metadata & Privacy Tools"
        description="Inspect and remove privacy-sensitive metadata from files directly in your browser."
      />
{!file && (
        <div className="smpt-card">
          <FileDropZone
            onFileSelected={setFile}
            accept="image/*,application/pdf,audio/*,video/*"
          />
        </div>
      )}

      {file && (
        <div className="smpt-card">
          <div className="smpt-actions" style={{ justifyContent: 'space-between' }}>
            <div className="smpt-file-summary">
              <span>
                <strong>{file.name}</strong>
              </span>
              <span>{file.type || 'Unknown type'}</span>
              <span>{formatBytes(file.size)}</span>
              <span>{formatDate(file.lastModified)}</span>
            </div>
            <button className="smpt-btn" onClick={handleReset}>
              Choose Different File
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="smpt-card">
          <p className="smpt-empty">Reading file metadata…</p>
        </div>
      )}

      {error && (
        <div className="smpt-card">
          <p className="smpt-error">{error}</p>
        </div>
      )}

      {result && !isLoading && (
        <>
          <div className="smpt-card">
            <p className="smpt-section-title">Privacy Risk Summary</p>
            <PrivacyRiskPanel privacy={result.privacy} />
          </div>

          <div className="smpt-card">
            <p className="smpt-section-title">Detected Metadata</p>
            <MetadataTable groups={result.groups} />
            {result.warnings.length > 0 && (
              <ul className="smpt-warnings">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>

          <CleanActionPanel file={file as File} category={result.file.category} cleaning={result.cleaning} />

          <div className="smpt-card">
            <p className="smpt-section-title">Metadata Report</p>
            <ReportActions result={result} />
          </div>
        </>
      )}
    </div>
  );
};

export default SmartMetadataPrivacyToolsPage;

import type { ResultSummary } from '../types';
import { downloadBlob, formatBytes } from '../lib/download';
import { trackSmartPdfEvent, SMART_PDF_EVENTS } from '../lib/analytics';

interface ResultPanelProps {
  result: ResultSummary;
  onCreateAnother: () => void;
}

/**
 * Shown after any generation operation (merge, extract, split, compress,
 * images-to-pdf). Never auto-downloads — the user must click Download.
 * For split output with multiple files, `result.files` already contains a
 * single zip GeneratedFile (see SmartPdfToolsPage), so this component just
 * downloads whatever files are present without needing to zip itself.
 */
export default function ResultPanel({ result, onCreateAnother }: ResultPanelProps) {
  const savedPercent =
    result.totalOriginalSize && result.totalOriginalSize > 0
      ? Math.round((1 - result.totalOutputSize / result.totalOriginalSize) * 100)
      : undefined;

  const handleDownload = () => {
    result.files.forEach((file) => {
      downloadBlob(file.blob, file.fileName);
      trackSmartPdfEvent(SMART_PDF_EVENTS.PDF_DOWNLOADED, { fileName: file.fileName, operation: result.operation ?? 'unknown' });
    });
  };

  return (
    <div className="spt-result-panel" role="region" aria-label="Result">
      <div className="spt-result-panel__icon" aria-hidden="true">✓</div>
      <h2 className="spt-result-panel__title">
        {result.files.length === 1 ? result.files[0].fileName : `${result.files.length} files ready`}
      </h2>

      <dl className="spt-result-panel__stats">
        <div>
          <dt>Output pages</dt>
          <dd>{result.files.reduce((sum, f) => sum + f.pageCount, 0)}</dd>
        </div>
        <div>
          <dt>Output size</dt>
          <dd>{formatBytes(result.totalOutputSize)}</dd>
        </div>
        {result.totalOriginalSize !== undefined && (
          <div>
            <dt>Original size</dt>
            <dd>{formatBytes(result.totalOriginalSize)}</dd>
          </div>
        )}
        {savedPercent !== undefined && (
          <div>
            <dt>Saved</dt>
            <dd className={savedPercent >= 0 ? 'spt-result-panel__saved' : 'spt-result-panel__grew'}>
              {savedPercent >= 0 ? `${savedPercent}% smaller` : `${Math.abs(savedPercent)}% larger — original may be better`}
            </dd>
          </div>
        )}
      </dl>

      <div className="spt-result-panel__actions">
        <button type="button" className="spt-btn spt-btn--primary" onClick={handleDownload}>
          Download {result.files.length > 1 ? 'ZIP' : ''}
        </button>
        <button type="button" className="spt-btn spt-btn--ghost" onClick={onCreateAnother}>
          Create another output
        </button>
      </div>
    </div>
  );
}

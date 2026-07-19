// App #003 — QR & Barcode Studio
// Displays a scan result with Copy / Open URL / Scan another actions.
// Never auto-navigates to scanned URLs or auto-executes scanned content.

import React, { useState, FC } from 'react';
import type { ScanOutcome } from '../types';
import { isSafeHttpUrl } from '../lib/validators';
import { track } from '../lib/analytics';

interface ScanResultProps {
  result: ScanOutcome;
  onScanAnother: () => void;
}

const ScanResult: FC<ScanResultProps> = ({ result, onScanAnother }) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const isUrl = isSafeHttpUrl(result.value);
  const isTel = result.value.startsWith('tel:');
  const isMailto = result.value.startsWith('mailto:');
  const isSms = result.value.startsWith('sms:');

  const handleCopy = async () => {
    setCopyError(null);
    try {
      if (!navigator.clipboard) throw new Error('Clipboard is not available in this browser.');
      await navigator.clipboard.writeText(result.value);
      setCopied(true);
      track('scan_result_copied', { format: result.format });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : 'Could not copy to clipboard.');
    }
  };

  const handleOpenUrl = () => {
    track('scan_url_opened', { format: result.format });
  };

  return (
    <div className="qbs-result" role="status">
      <div className="qbs-result-format">{result.format}</div>
      <div className="qbs-result-value">{result.value}</div>

      <div className="qbs-btn-row">
        <button type="button" className="qbs-btn qbs-btn-secondary" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>

        {isUrl && (
          <a
            className="qbs-btn"
            href={result.value}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleOpenUrl}
          >
            Open URL
          </a>
        )}

        {isTel && (
          <a className="qbs-btn" href={result.value}>
            Call number
          </a>
        )}

        {isMailto && (
          <a className="qbs-btn" href={result.value}>
            Send email
          </a>
        )}

        {isSms && (
          <a className="qbs-btn" href={result.value}>
            Send text
          </a>
        )}

        <button type="button" className="qbs-btn qbs-btn-secondary" onClick={onScanAnother}>
          Scan another
        </button>
      </div>

      {copyError && (
        <div className="qbs-error" role="alert">
          {copyError}
        </div>
      )}
    </div>
  );
};

export default ScanResult;

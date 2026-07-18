// App #003 — QR & Barcode Studio
// Displays recent local-only scan history with copy/remove/clear actions.

import React, { FC } from 'react';
import type { ScanHistoryEntry } from '../types';

interface ScanHistoryProps {
  entries: ScanHistoryEntry[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onCopy: (value: string) => void;
}

const ScanHistoryList: FC<ScanHistoryProps> = ({ entries, onRemove, onClear, onCopy }) => {
  if (entries.length === 0) {
    return <div className="qbs-empty-state">No scans yet. Your last 10 scans will appear here.</div>;
  }

  return (
    <div>
      <ul className="qbs-history-list">
        {entries.map((entry) => (
          <li key={entry.id} className="qbs-history-item">
            <div className="qbs-history-value" title={entry.value}>
              <strong>{entry.format}:</strong> {entry.value}
            </div>
            <div className="qbs-history-actions">
              <button
                type="button"
                className="qbs-icon-btn"
                onClick={() => onCopy(entry.value)}
                aria-label="Copy scan value"
              >
                Copy
              </button>
              <button
                type="button"
                className="qbs-icon-btn"
                onClick={() => onRemove(entry.id)}
                aria-label="Remove scan from history"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="qbs-btn-row">
        <button type="button" className="qbs-btn qbs-btn-danger" onClick={onClear}>
          Clear history
        </button>
      </div>
    </div>
  );
};

export default ScanHistoryList;

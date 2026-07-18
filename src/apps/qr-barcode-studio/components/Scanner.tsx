// App #003 — QR & Barcode Studio
// Top-level Scanner panel: Camera / Upload Image tabs, scan result, and
// local scan history.

import React, { useState, FC } from 'react';
import CameraScanner from './CameraScanner';
import ImageScanner from './ImageScanner';
import ScanResult from './ScanResult';
import ScanHistoryList from './ScanHistory';
import { useScanHistory } from '../hooks/useScanHistory';
import type { ScanOutcome } from '../types';

type ScanSourceTab = 'camera' | 'image';

const Scanner: FC = () => {
  const [activeSource, setActiveSource] = useState<ScanSourceTab>('camera');
  const [result, setResult] = useState<ScanOutcome | null>(null);
  const { entries, addEntry, removeEntry, clearHistory } = useScanHistory();

  const handleResult = (outcome: ScanOutcome) => {
    setResult(outcome);
    addEntry(outcome);
  };

  const handleCopyFromHistory = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard may be unavailable; the value is still visible to copy manually.
    }
  };

  return (
    <div className="qbs-layout">
      <div className="qbs-panel">
        <h2 className="qbs-panel-title">Scan a code</h2>
        <div className="qbs-tabs" role="tablist" aria-label="Scan source">
          <button
            type="button"
            role="tab"
            aria-selected={activeSource === 'camera'}
            className="qbs-tab"
            onClick={() => setActiveSource('camera')}
          >
            Camera
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSource === 'image'}
            className="qbs-tab"
            onClick={() => setActiveSource('image')}
          >
            Upload Image
          </button>
        </div>

        <div className="qbs-scanner">
          {activeSource === 'camera' ? (
            <CameraScanner onResult={handleResult} />
          ) : (
            <ImageScanner onResult={handleResult} />
          )}
        </div>

        {result && <ScanResult result={result} onScanAnother={() => setResult(null)} />}
      </div>

      <div className="qbs-panel">
        <h2 className="qbs-panel-title">Recent scans</h2>
        <ScanHistoryList
          entries={entries}
          onRemove={removeEntry}
          onClear={clearHistory}
          onCopy={handleCopyFromHistory}
        />
      </div>
    </div>
  );
};

export default Scanner;

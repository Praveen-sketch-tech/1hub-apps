// App #003 — QR & Barcode Studio
// Root page component. All imports below are relative to THIS file's own
// directory (src/apps/qr-barcode-studio/), per the integration spec.

import React, { useState, FC } from 'react';
import StudioTabs from './components/StudioTabs';
import QrGenerator from './components/QrGenerator';
import BarcodeGenerator from './components/BarcodeGenerator';
import Scanner from './components/Scanner';
import './qr-barcode-studio.css';
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'

type StudioMode = 'qr' | 'barcode' | 'scanner';

const TABS = [
  { id: 'qr', label: 'QR Generator' },
  { id: 'barcode', label: 'Barcode Generator' },
  { id: 'scanner', label: 'Scanner' },
];

const QrBarcodeStudioPage: FC = () => {
  const [mode, setMode] = useState<StudioMode>('qr');

  return (
    <div className="qbs-page">
      <ToolAppHeader
        appNumber="003"
        title="QR & Barcode Studio"
        description="Create and scan QR codes and barcodes privately in your browser."
      />

      <StudioTabs
        tabs={TABS}
        activeId={mode}
        onChange={(id) => setMode(id as StudioMode)}
        idPrefix="qbs-mode"
      />

      <div
        role="tabpanel"
        id="qbs-mode-panel-qr"
        aria-labelledby="qbs-mode-tab-qr"
        hidden={mode !== 'qr'}
      >
        {mode === 'qr' && <QrGenerator />}
      </div>
      <div
        role="tabpanel"
        id="qbs-mode-panel-barcode"
        aria-labelledby="qbs-mode-tab-barcode"
        hidden={mode !== 'barcode'}
      >
        {mode === 'barcode' && <BarcodeGenerator />}
      </div>
      <div
        role="tabpanel"
        id="qbs-mode-panel-scanner"
        aria-labelledby="qbs-mode-tab-scanner"
        hidden={mode !== 'scanner'}
      >
        {mode === 'scanner' && <Scanner />}
      </div>
    </div>
  );
};

export default QrBarcodeStudioPage;

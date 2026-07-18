// App #003 — QR & Barcode Studio
// Live QR preview plus PNG/SVG download and print actions.

import React, { useState, FC } from 'react';
import { downloadPngDataUrl, downloadSvgMarkup, sanitizeFilename } from '../lib/download';
import { printImage } from '../lib/print';

interface QrPreviewProps {
  pngDataUrl: string | null;
  svgMarkup: string | null;
  isLoading: boolean;
  errorMessage: string | null;
  onDownload: (format: 'png' | 'svg') => void;
  onPrint: () => void;
  encodedValue: string;
}

const QrPreview: FC<QrPreviewProps> = ({
  pngDataUrl,
  svgMarkup,
  isLoading,
  errorMessage,
  onDownload,
  onPrint,
  encodedValue,
}) => {
  const [filename, setFilename] = useState('qr-code');

  const handleDownloadPng = () => {
    if (!pngDataUrl) return;
    downloadPngDataUrl(pngDataUrl, sanitizeFilename(filename, 'qr-code'));
    onDownload('png');
  };

  const handleDownloadSvg = () => {
    if (!svgMarkup) return;
    downloadSvgMarkup(svgMarkup, sanitizeFilename(filename, 'qr-code'));
    onDownload('svg');
  };

  const handlePrint = () => {
    if (!pngDataUrl) return;
    printImage({ imageDataUrl: pngDataUrl, title: 'QR Code', value: encodedValue });
    onPrint();
  };

  return (
    <div>
      <div className="qbs-preview">
        {isLoading && <div className="qbs-preview-placeholder">Generating QR code…</div>}
        {!isLoading && pngDataUrl && (
          <img className="qbs-preview-image" src={pngDataUrl} alt="Generated QR code" />
        )}
        {!isLoading && !pngDataUrl && !errorMessage && (
          <div className="qbs-preview-placeholder">
            Fill in the form to see your QR code appear here.
          </div>
        )}
        {errorMessage && (
          <div className="qbs-error" role="alert">
            {errorMessage}
          </div>
        )}
      </div>

      <div className="qbs-field" style={{ marginTop: '1rem' }}>
        <label className="qbs-label" htmlFor="qbs-qr-filename">
          File name
        </label>
        <input
          id="qbs-qr-filename"
          className="qbs-input"
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
        />
      </div>

      <div className="qbs-btn-row">
        <button type="button" className="qbs-btn" disabled={!pngDataUrl} onClick={handleDownloadPng}>
          Download PNG
        </button>
        <button
          type="button"
          className="qbs-btn qbs-btn-secondary"
          disabled={!svgMarkup}
          onClick={handleDownloadSvg}
        >
          Download SVG
        </button>
        <button
          type="button"
          className="qbs-btn qbs-btn-secondary"
          disabled={!pngDataUrl}
          onClick={handlePrint}
        >
          Print
        </button>
      </div>
    </div>
  );
};

export default QrPreview;

// App #003 — QR & Barcode Studio
// Live barcode preview plus PNG/SVG download and print actions.

import React, { useState, FC } from 'react';
import { downloadPngDataUrl, downloadSvgMarkup, sanitizeFilename } from '../lib/download';
import { printImage } from '../lib/print';

interface BarcodePreviewProps {
  svgMarkup: string | null;
  pngDataUrl: string | null;
  errorMessage: string | null;
  onDownload: (format: 'png' | 'svg') => void;
  onPrint: () => void;
  encodedValue: string;
}

const BarcodePreview: FC<BarcodePreviewProps> = ({
  svgMarkup,
  pngDataUrl,
  errorMessage,
  onDownload,
  onPrint,
  encodedValue,
}) => {
  const [filename, setFilename] = useState('barcode');

  const handleDownloadPng = () => {
    if (!pngDataUrl) return;
    downloadPngDataUrl(pngDataUrl, sanitizeFilename(filename, 'barcode'));
    onDownload('png');
  };

  const handleDownloadSvg = () => {
    if (!svgMarkup) return;
    downloadSvgMarkup(svgMarkup, sanitizeFilename(filename, 'barcode'));
    onDownload('svg');
  };

  const handlePrint = () => {
    if (!pngDataUrl) return;
    printImage({ imageDataUrl: pngDataUrl, title: 'Barcode', value: encodedValue });
    onPrint();
  };

  return (
    <div>
      <div className="qbs-preview">
        {svgMarkup ? (
          <div
            className="qbs-preview-image"
            // Markup is generated locally by JsBarcode from the user's own
            // input — not user-supplied HTML from an external source.
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : (
          !errorMessage && (
            <div className="qbs-preview-placeholder">
              Enter a value to see your barcode appear here.
            </div>
          )
        )}
        {errorMessage && (
          <div className="qbs-error" role="alert">
            {errorMessage}
          </div>
        )}
      </div>

      <div className="qbs-field" style={{ marginTop: '1rem' }}>
        <label className="qbs-label" htmlFor="qbs-bc-filename">
          File name
        </label>
        <input
          id="qbs-bc-filename"
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

export default BarcodePreview;

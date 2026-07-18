// App #003 — QR & Barcode Studio
// Top-level Barcode Generator panel: value entry, customization, and live
// debounced preview with format-aware validation.

import React, { useEffect, useRef, useState, FC } from 'react';
import BarcodeCustomizer from './BarcodeCustomizer';
import BarcodePreview from './BarcodePreview';
import { renderBarcode, renderBarcodePng } from '../lib/barcodeGenerator';
import { validateBarcodeValue, barcodeFormatHint } from '../lib/validators';
import { DEFAULT_BARCODE_CUSTOMIZATION } from '../types';
import type { BarcodeCustomization, DownloadFormat } from '../types';
import { track } from '../lib/analytics';

const DEBOUNCE_MS = 350;

const BarcodeGenerator: FC = () => {
  const [value, setValue] = useState('');
  const [customization, setCustomization] = useState<BarcodeCustomization>({
    ...DEFAULT_BARCODE_CUSTOMIZATION,
  });
  const [inputError, setInputError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setSvgMarkup(null);
      setPngDataUrl(null);
      setInputError(null);
      setRenderError(null);
      return;
    }

    const validation = validateBarcodeValue(customization.format, value);
    setInputError(validation.valid ? null : validation.message);
    if (!validation.valid) {
      setSvgMarkup(null);
      setPngDataUrl(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      setRenderError(null);
      try {
        const { svgMarkup: svg } = renderBarcode(value.trim(), customization);
        if (requestId !== requestIdRef.current) return;
        setSvgMarkup(svg);
        const png = await renderBarcodePng(svg);
        if (requestId !== requestIdRef.current) return;
        setPngDataUrl(png);
        track('barcode_generated', { format: customization.format });
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setRenderError(err instanceof Error ? err.message : 'Could not generate barcode.');
        setSvgMarkup(null);
        setPngDataUrl(null);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, customization]);

  const handleDownload = (format: DownloadFormat) => {
    track('barcode_downloaded', { format: customization.format, file_type: format });
  };

  const handlePrint = () => {
    track('print_used', { source: 'barcode' });
  };

  return (
    <div className="qbs-layout">
      <div className="qbs-panel">
        <h2 className="qbs-panel-title">1. Choose format & enter value</h2>
        <div className="qbs-field">
          <label className="qbs-label" htmlFor="qbs-bc-value">
            Value to encode
          </label>
          <input
            id="qbs-bc-value"
            className="qbs-input"
            type="text"
            placeholder={barcodeFormatHint(customization.format)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {inputError && (
            <div className="qbs-error" role="alert">
              {inputError}
            </div>
          )}
        </div>

        <div className="qbs-panel" style={{ marginTop: '1rem' }}>
          <h2 className="qbs-panel-title">2. Customize</h2>
          <BarcodeCustomizer value={customization} onChange={setCustomization} />
        </div>
      </div>

      <div className="qbs-panel">
        <h2 className="qbs-panel-title">Preview & download</h2>
        <BarcodePreview
          svgMarkup={svgMarkup}
          pngDataUrl={pngDataUrl}
          errorMessage={renderError}
          onDownload={handleDownload}
          onPrint={handlePrint}
          encodedValue={value}
        />
      </div>
    </div>
  );
};

export default BarcodeGenerator;

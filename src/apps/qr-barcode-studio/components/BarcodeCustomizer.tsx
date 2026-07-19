// App #003 — QR & Barcode Studio
// Customization controls for the barcode generator.

import React, { FC } from 'react';
import type { BarcodeCustomization, BarcodeFormat } from '../types';
import { barcodeFormatHint } from '../lib/validators';

interface BarcodeCustomizerProps {
  value: BarcodeCustomization;
  onChange: (value: BarcodeCustomization) => void;
}

const FORMATS: BarcodeFormat[] = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC', 'ITF14'];

const BarcodeCustomizer: FC<BarcodeCustomizerProps> = ({ value, onChange }) => {
  return (
    <div>
      <div className="qbs-field">
        <label className="qbs-label" htmlFor="qbs-bc-format">
          Barcode format
        </label>
        <select
          id="qbs-bc-format"
          className="qbs-select"
          value={value.format}
          onChange={(e) => onChange({ ...value, format: e.target.value as BarcodeFormat })}
        >
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <div className="qbs-hint">{barcodeFormatHint(value.format)}</div>
      </div>

      <div className="qbs-row">
        <div className="qbs-field">
          <label className="qbs-label" htmlFor="qbs-bc-width">
            Bar width: {value.width}
          </label>
          <input
            id="qbs-bc-width"
            type="range"
            min={1}
            max={4}
            step={1}
            value={value.width}
            onChange={(e) => onChange({ ...value, width: Number(e.target.value) })}
          />
        </div>
        <div className="qbs-field">
          <label className="qbs-label" htmlFor="qbs-bc-height">
            Height: {value.height}px
          </label>
          <input
            id="qbs-bc-height"
            type="range"
            min={40}
            max={220}
            step={10}
            value={value.height}
            onChange={(e) => onChange({ ...value, height: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="qbs-field qbs-checkbox-row">
        <input
          id="qbs-bc-display-value"
          type="checkbox"
          checked={value.displayValue}
          onChange={(e) => onChange({ ...value, displayValue: e.target.checked })}
        />
        <label className="qbs-label" htmlFor="qbs-bc-display-value" style={{ marginBottom: 0 }}>
          Show text under barcode
        </label>
      </div>

      {value.displayValue && (
        <div className="qbs-field">
          <label className="qbs-label" htmlFor="qbs-bc-fontsize">
            Font size: {value.fontSize}px
          </label>
          <input
            id="qbs-bc-fontsize"
            type="range"
            min={10}
            max={28}
            step={1}
            value={value.fontSize}
            onChange={(e) => onChange({ ...value, fontSize: Number(e.target.value) })}
          />
        </div>
      )}

      <div className="qbs-field">
        <label className="qbs-label" htmlFor="qbs-bc-margin">
          Margin: {value.margin}px
        </label>
        <input
          id="qbs-bc-margin"
          type="range"
          min={0}
          max={40}
          step={2}
          value={value.margin}
          onChange={(e) => onChange({ ...value, margin: Number(e.target.value) })}
        />
      </div>

      <div className="qbs-row">
        <div className="qbs-field">
          <label className="qbs-label" htmlFor="qbs-bc-fg">
            Bar color
          </label>
          <input
            id="qbs-bc-fg"
            className="qbs-color-input"
            type="color"
            value={value.foregroundColor}
            onChange={(e) => onChange({ ...value, foregroundColor: e.target.value })}
          />
        </div>
        <div className="qbs-field">
          <label className="qbs-label" htmlFor="qbs-bc-bg">
            Background color
          </label>
          <input
            id="qbs-bc-bg"
            className="qbs-color-input"
            type="color"
            value={value.backgroundColor}
            onChange={(e) => onChange({ ...value, backgroundColor: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
};

export default BarcodeCustomizer;

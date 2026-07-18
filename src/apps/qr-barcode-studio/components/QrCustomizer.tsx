// App #003 — QR & Barcode Studio
// Customization controls for the QR generator: size, colors, margin,
// error correction level, and an optional center logo.

import React, { useRef, useState, FC } from 'react';
import type { ErrorCorrectionLevel, QrCustomization } from '../types';
import { DEFAULT_QR_CUSTOMIZATION } from '../types';

interface QrCustomizerProps {
  value: QrCustomization;
  onChange: (value: QrCustomization) => void;
  onLogoAdded: () => void;
}

const EC_LEVELS: { id: ErrorCorrectionLevel; label: string }[] = [
  { id: 'L', label: 'L — Low (7%)' },
  { id: 'M', label: 'M — Medium (15%)' },
  { id: 'Q', label: 'Q — Quartile (25%)' },
  { id: 'H', label: 'H — High (30%)' },
];

const MAX_LOGO_BYTES = 3 * 1024 * 1024;

const QrCustomizer: FC<QrCustomizerProps> = ({ value, onChange, onLogoAdded }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const handleLogoFile = (file: File | null) => {
    setLogoError(null);
    if (!file) return;

    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      setLogoError('Please upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Logo image is too large (max 3 MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onChange({
        ...value,
        errorCorrectionLevel: 'H',
        logo: { imageDataUrl: dataUrl, sizeRatio: 0.2, withBackground: true },
      });
      onLogoAdded();
    };
    reader.onerror = () => setLogoError('Could not read the selected image.');
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="qbs-field">
        <label className="qbs-label" htmlFor="qbs-qr-size">
          Size: {value.size}px
        </label>
        <input
          id="qbs-qr-size"
          type="range"
          min={256}
          max={2048}
          step={64}
          value={value.size}
          onChange={(e) => onChange({ ...value, size: Number(e.target.value) })}
        />
      </div>

      <div className="qbs-row">
        <div className="qbs-field">
          <label className="qbs-label" htmlFor="qbs-qr-fg">
            Foreground color
          </label>
          <input
            id="qbs-qr-fg"
            className="qbs-color-input"
            type="color"
            value={value.foregroundColor}
            onChange={(e) => onChange({ ...value, foregroundColor: e.target.value })}
          />
        </div>
        <div className="qbs-field">
          <label className="qbs-label" htmlFor="qbs-qr-bg">
            Background color
          </label>
          <input
            id="qbs-qr-bg"
            className="qbs-color-input"
            type="color"
            value={value.backgroundColor}
            onChange={(e) => onChange({ ...value, backgroundColor: e.target.value })}
          />
        </div>
      </div>

      <div className="qbs-field">
        <label className="qbs-label" htmlFor="qbs-qr-margin">
          Margin: {value.margin} modules
        </label>
        <input
          id="qbs-qr-margin"
          type="range"
          min={0}
          max={10}
          step={1}
          value={value.margin}
          onChange={(e) => onChange({ ...value, margin: Number(e.target.value) })}
        />
      </div>

      <div className="qbs-field">
        <label className="qbs-label" htmlFor="qbs-qr-ec">
          Error correction level
        </label>
        <select
          id="qbs-qr-ec"
          className="qbs-select"
          value={value.errorCorrectionLevel}
          onChange={(e) =>
            onChange({ ...value, errorCorrectionLevel: e.target.value as ErrorCorrectionLevel })
          }
        >
          {EC_LEVELS.map((lvl) => (
            <option key={lvl.id} value={lvl.id}>
              {lvl.label}
            </option>
          ))}
        </select>
        {value.logo && (
          <div className="qbs-hint">A logo is added, so H is used automatically.</div>
        )}
      </div>

      <div className="qbs-field">
        <label className="qbs-label" htmlFor="qbs-qr-logo">
          Center logo (optional)
        </label>
        <input
          id="qbs-qr-logo"
          ref={fileInputRef}
          className="qbs-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => handleLogoFile(e.target.files?.[0] ?? null)}
        />
        {value.logo && (
          <div className="qbs-logo-preview">
            <img className="qbs-logo-thumb" src={value.logo.imageDataUrl} alt="Logo preview" />
            <button
              type="button"
              className="qbs-icon-btn"
              onClick={() => {
                onChange({ ...value, logo: null });
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              Remove logo
            </button>
          </div>
        )}
        {logoError && (
          <div className="qbs-error" role="alert">
            {logoError}
          </div>
        )}
        <div className="qbs-warning">
          A large logo can make the QR code harder to scan. Keep it small and centered for best
          results.
        </div>
      </div>

      <button
        type="button"
        className="qbs-btn qbs-btn-secondary"
        onClick={() => {
          onChange({ ...DEFAULT_QR_CUSTOMIZATION });
          setLogoError(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      >
        Reset customization
      </button>
    </div>
  );
};

export default QrCustomizer;

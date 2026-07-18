// App #003 — QR & Barcode Studio
// Top-level QR Generator panel: type selection, data entry, customization,
// and live debounced preview.

import React, { useEffect, useMemo, useRef, useState, FC } from 'react';
import { QrTypeSelector, QrDataForm } from './QrTypeSelector';
import QrCustomizer from './QrCustomizer';
import QrPreview from './QrPreview';
import { buildQrPayload } from '../lib/qrPayload';
import { renderQrCode } from '../lib/qrGenerator';
import {
  validateUrl,
  validateText,
  validatePhone,
  validateEmail,
  validateSsid,
  validateVCard,
  normalizeUrl,
} from '../lib/validators';
import { DEFAULT_QR_CUSTOMIZATION } from '../types';
import type { QrData, QrType, QrCustomization, DownloadFormat } from '../types';
import { track } from '../lib/analytics';

function defaultDataFor(type: QrType): QrData {
  switch (type) {
    case 'url':
      return { type: 'url', data: { url: '' } };
    case 'text':
      return { type: 'text', data: { text: '' } };
    case 'phone':
      return { type: 'phone', data: { phone: '' } };
    case 'email':
      return { type: 'email', data: { email: '', subject: '', message: '' } };
    case 'sms':
      return { type: 'sms', data: { phone: '', message: '' } };
    case 'wifi':
      return { type: 'wifi', data: { ssid: '', password: '', security: 'WPA', hidden: false } };
    case 'vcard':
      return {
        type: 'vcard',
        data: { firstName: '', lastName: '', organization: '', jobTitle: '', phone: '', email: '', website: '' },
      };
    default:
      return { type: 'text', data: { text: '' } };
  }
}

function validateQrData(qr: QrData): string | null {
  switch (qr.type) {
    case 'url': {
      const result = validateUrl(qr.data.url);
      return result.valid ? null : result.message;
    }
    case 'text': {
      const result = validateText(qr.data.text);
      return result.valid ? null : result.message;
    }
    case 'phone': {
      const result = validatePhone(qr.data.phone);
      return result.valid ? null : result.message;
    }
    case 'email': {
      const result = validateEmail(qr.data.email);
      return result.valid ? null : result.message;
    }
    case 'sms': {
      const result = validatePhone(qr.data.phone);
      return result.valid ? null : result.message;
    }
    case 'wifi': {
      const result = validateSsid(qr.data.ssid);
      return result.valid ? null : result.message;
    }
    case 'vcard': {
      const result = validateVCard(qr.data.firstName);
      return result.valid ? null : result.message;
    }
    default:
      return null;
  }
}

function hasAnyInput(qr: QrData): boolean {
  switch (qr.type) {
    case 'url':
      return qr.data.url.trim().length > 0;
    case 'text':
      return qr.data.text.trim().length > 0;
    case 'phone':
      return qr.data.phone.trim().length > 0;
    case 'email':
      return qr.data.email.trim().length > 0;
    case 'sms':
      return qr.data.phone.trim().length > 0;
    case 'wifi':
      return qr.data.ssid.trim().length > 0;
    case 'vcard':
      return qr.data.firstName.trim().length > 0;
    default:
      return false;
  }
}

const DEBOUNCE_MS = 350;

const QrGenerator: FC = () => {
  const [activeType, setActiveType] = useState<QrType>('url');
  const [qrData, setQrData] = useState<QrData>(defaultDataFor('url'));
  const [customization, setCustomization] = useState<QrCustomization>({
    ...DEFAULT_QR_CUSTOMIZATION,
  });
  const [inputError, setInputError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const encodedValueForDisplay = useMemo(() => {
    if (qrData.type === 'url') return normalizeUrl(qrData.data.url);
    return '';
  }, [qrData]);

  const handleTypeSelect = (type: QrType) => {
    setActiveType(type);
    setQrData(defaultDataFor(type));
    setInputError(null);
    setPngDataUrl(null);
    setSvgMarkup(null);
    setRenderError(null);
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!hasAnyInput(qrData)) {
      setPngDataUrl(null);
      setSvgMarkup(null);
      setInputError(null);
      setRenderError(null);
      return;
    }

    const validationMessage = validateQrData(qrData);
    setInputError(validationMessage);
    if (validationMessage) {
      setPngDataUrl(null);
      setSvgMarkup(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setRenderError(null);
      try {
        const payload = buildQrPayload(qrData);
        const result = await renderQrCode(payload, customization);
        if (requestId !== requestIdRef.current) return; // stale response
        setPngDataUrl(result.pngDataUrl);
        setSvgMarkup(result.svgMarkup);
        track('qr_generated', { qr_type: qrData.type });
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setRenderError(err instanceof Error ? err.message : 'Could not generate QR code.');
        setPngDataUrl(null);
        setSvgMarkup(null);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrData, customization]);

  const handleDownload = (format: DownloadFormat) => {
    track('qr_downloaded', { qr_type: qrData.type, format });
  };

  const handlePrint = () => {
    track('print_used', { source: 'qr' });
  };

  const handleLogoAdded = () => {
    track('qr_logo_added', { qr_type: qrData.type });
  };

  return (
    <div className="qbs-layout">
      <div className="qbs-panel">
        <h2 className="qbs-panel-title">1. Choose QR type</h2>
        <QrTypeSelector activeType={activeType} onSelect={handleTypeSelect} />

        <h2 className="qbs-panel-title">2. Enter data</h2>
        <QrDataForm value={qrData} onChange={setQrData} errorMessage={inputError} />

        <div className="qbs-panel" style={{ marginTop: '1rem' }}>
          <h2 className="qbs-panel-title">3. Customize</h2>
          <QrCustomizer
            value={customization}
            onChange={setCustomization}
            onLogoAdded={handleLogoAdded}
          />
        </div>
      </div>

      <div className="qbs-panel">
        <h2 className="qbs-panel-title">Preview & download</h2>
        <QrPreview
          pngDataUrl={pngDataUrl}
          svgMarkup={svgMarkup}
          isLoading={isLoading}
          errorMessage={renderError}
          onDownload={handleDownload}
          onPrint={handlePrint}
          encodedValue={encodedValueForDisplay}
        />
      </div>
    </div>
  );
};

export default QrGenerator;

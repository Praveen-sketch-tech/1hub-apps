// App #003 — QR & Barcode Studio
// Wraps the `jsbarcode` package to generate 1D barcodes locally in the browser.

import JsBarcode from 'jsbarcode';
import type { BarcodeCustomization } from '../types';

export interface BarcodeRenderResult {
  pngDataUrl: string;
  svgMarkup: string;
}

const JSBARCODE_FORMAT_MAP: Record<BarcodeCustomization['format'], string> = {
  CODE128: 'CODE128',
  CODE39: 'CODE39',
  EAN13: 'EAN13',
  EAN8: 'EAN8',
  UPC: 'UPC',
  ITF14: 'ITF14',
};

export function renderBarcode(value: string, customization: BarcodeCustomization): BarcodeRenderResult {
  if (!value) {
    throw new Error('Nothing to encode yet.');
  }

  const options = {
    format: JSBARCODE_FORMAT_MAP[customization.format],
    width: customization.width,
    height: customization.height,
    displayValue: customization.displayValue,
    fontSize: customization.fontSize,
    margin: customization.margin,
    lineColor: customization.foregroundColor,
    background: customization.backgroundColor,
  };

  // SVG output (also used as the source of truth for the PNG render so both
  // downloads stay pixel-consistent).
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const svgEl = document.createElementNS(svgNamespace, 'svg');

  try {
    JsBarcode(svgEl, value, options);
  } catch (err) {
    throw new Error(
      `Could not generate barcode: ${err instanceof Error ? err.message : 'Invalid value for this format.'}`
    );
  }

  const svgMarkup = new XMLSerializer().serializeToString(svgEl);

  return {
    svgMarkup,
    pngDataUrl: '', // populated lazily by renderBarcodePng (needs async image decode)
  };
}

/**
 * Produces a high-resolution PNG data URL from barcode SVG markup by
 * rasterizing it onto an off-screen canvas at the requested scale.
 */
export async function renderBarcodePng(svgMarkup: string, scale = 3): Promise<string> {
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not rasterize barcode image.'));
      image.src = url;
    });

    const width = img.width || 300;
    const height = img.height || 150;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported in this browser.');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// App #003 — QR & Barcode Studio
// Wraps the `qrcode` package to generate QR codes locally in the browser.
// Handles high-resolution PNG output (via canvas), SVG output, and optional
// center-logo compositing.

import QRCode from 'qrcode';
import type { QRCodeToDataURLOptions } from 'qrcode';
import type { QrCustomization } from '../types';

export interface QrRenderResult {
  /** data:image/png;base64,... at full requested resolution */
  pngDataUrl: string;
  /** raw <svg>...</svg> markup */
  svgMarkup: string;
}

/**
 * Renders a QR code to both PNG (data URL) and SVG (markup) at the
 * requested customization settings, compositing an optional center logo
 * onto the PNG output.
 */
export async function renderQrCode(
  payload: string,
  customization: QrCustomization
): Promise<QrRenderResult> {
  if (!payload) {
    throw new Error('Nothing to encode yet.');
  }

  const { size, foregroundColor, backgroundColor, margin, errorCorrectionLevel, logo } =
    customization;

  // Logos reduce redundancy tolerance, so force a high error-correction
  // level automatically when a logo is present (per spec requirement).
  const effectiveEcLevel = logo ? 'H' : errorCorrectionLevel;

  const qrOptions: QRCodeToDataURLOptions = {
    errorCorrectionLevel: effectiveEcLevel,
    margin,
    width: size,
    color: {
      dark: foregroundColor,
      light: backgroundColor,
    },
  };

  let pngDataUrl: string;
  try {
    pngDataUrl = await QRCode.toDataURL(payload, qrOptions);
  } catch (err) {
    throw new Error(
      `Could not generate QR code: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }

  if (logo) {
    pngDataUrl = await compositeLogoOntoPng(pngDataUrl, logo, size);
  }

  let svgMarkup: string;
  try {
    svgMarkup = await QRCode.toString(payload, {
      type: 'svg',
      errorCorrectionLevel: effectiveEcLevel,
      margin,
      width: size,
      color: {
        dark: foregroundColor,
        light: backgroundColor,
      },
    });
  } catch (err) {
    throw new Error(
      `Could not generate QR SVG: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }

  if (logo) {
    svgMarkup = embedLogoIntoSvg(svgMarkup, logo, size);
  }

  return { pngDataUrl, svgMarkup };
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load logo image.'));
    img.src = src;
  });
}

async function compositeLogoOntoPng(
  qrDataUrl: string,
  logo: NonNullable<QrCustomization['logo']>,
  size: number
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  const [qrImg, logoImg] = await Promise.all([loadImage(qrDataUrl), loadImage(logo.imageDataUrl)]);

  ctx.drawImage(qrImg, 0, 0, size, size);

  // Cap logo size so the QR remains scannable, even if a larger ratio was requested.
  const safeRatio = Math.min(Math.max(logo.sizeRatio, 0.1), 0.3);
  const logoSize = Math.round(size * safeRatio);
  const logoX = Math.round((size - logoSize) / 2);
  const logoY = Math.round((size - logoSize) / 2);

  if (logo.withBackground) {
    const pad = Math.round(logoSize * 0.12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(logoX - pad, logoY - pad, logoSize + pad * 2, logoSize + pad * 2);
  }

  // Preserve aspect ratio within the logo bounding box.
  const aspect = logoImg.width / logoImg.height;
  let drawWidth = logoSize;
  let drawHeight = logoSize;
  if (aspect > 1) {
    drawHeight = logoSize / aspect;
  } else if (aspect < 1) {
    drawWidth = logoSize * aspect;
  }
  const drawX = logoX + (logoSize - drawWidth) / 2;
  const drawY = logoY + (logoSize - drawHeight) / 2;

  ctx.drawImage(logoImg, drawX, drawY, drawWidth, drawHeight);

  return canvas.toDataURL('image/png');
}

function embedLogoIntoSvg(
  svgMarkup: string,
  logo: NonNullable<QrCustomization['logo']>,
  size: number
): string {
  const safeRatio = Math.min(Math.max(logo.sizeRatio, 0.1), 0.3);
  const logoSize = size * safeRatio;
  const x = (size - logoSize) / 2;
  const y = (size - logoSize) / 2;

  const bg = logo.withBackground
    ? `<rect x="${x - logoSize * 0.12}" y="${y - logoSize * 0.12}" width="${
        logoSize * 1.24
      }" height="${logoSize * 1.24}" fill="#ffffff" />`
    : '';

  const logoFragment = `${bg}<image href="${logo.imageDataUrl}" x="${x}" y="${y}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" />`;

  return svgMarkup.replace('</svg>', `${logoFragment}</svg>`);
}

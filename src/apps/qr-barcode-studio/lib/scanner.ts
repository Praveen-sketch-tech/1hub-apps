// App #003 — QR & Barcode Studio
// Wraps @zxing/browser for local, in-browser QR/barcode decoding from
// either a live camera stream or an uploaded image. No data ever leaves
// the browser.

import {
  BrowserMultiFormatReader,
  IScannerControls,
} from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
import type { ScanOutcome } from '../types';

const HINTS = new Map();
HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
]);
HINTS.set(DecodeHintType.TRY_HARDER, true);

function readableFormat(format: BarcodeFormat): string {
  const names: Partial<Record<BarcodeFormat, string>> = {
    [BarcodeFormat.QR_CODE]: 'QR Code',
    [BarcodeFormat.CODE_128]: 'CODE128',
    [BarcodeFormat.CODE_39]: 'CODE39',
    [BarcodeFormat.EAN_13]: 'EAN-13',
    [BarcodeFormat.EAN_8]: 'EAN-8',
    [BarcodeFormat.UPC_A]: 'UPC-A',
    [BarcodeFormat.UPC_E]: 'UPC-E',
    [BarcodeFormat.ITF]: 'ITF',
  };
  return names[format] ?? String(format);
}

export function createReader(): BrowserMultiFormatReader {
  return new BrowserMultiFormatReader(HINTS);
}

export async function listVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  return BrowserMultiFormatReader.listVideoInputDevices();
}

/**
 * Starts continuous decoding from a camera stream into the given video
 * element. Prefers the rear/environment camera on mobile devices.
 * Returns scanner controls; call .stop() to release the camera.
 */
export async function startCameraScan(
  reader: BrowserMultiFormatReader,
  videoElement: HTMLVideoElement,
  onResult: (outcome: ScanOutcome) => void,
  onError: (message: string) => void
): Promise<IScannerControls> {
  const devices = await listVideoInputDevices();
  if (devices.length === 0) {
    throw new Error('No camera was found on this device.');
  }

  const rearCamera = devices.find((d) => /back|rear|environment/i.test(d.label));
  const deviceId = (rearCamera ?? devices[devices.length - 1]).deviceId;

  const controls = await reader.decodeFromVideoDevice(
    deviceId,
    videoElement,
    (result, error) => {
      if (result) {
        onResult({
          format: readableFormat(result.getBarcodeFormat()),
          value: result.getText(),
          source: 'camera',
        });
      } else if (error && !(error instanceof NotFoundException)) {
        // NotFoundException fires continuously while no code is in view —
        // that is expected and not a real error.
        onError(error.message ?? 'Scanner error.');
      }
    }
  );

  return controls;
}

/**
 * Decodes a QR/barcode from a user-uploaded image file. Runs entirely
 * client-side; the image never leaves the browser.
 */
export async function decodeFromImageFile(file: File): Promise<ScanOutcome> {
  const reader = createReader();
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not load the selected image.'));
      image.src = url;
    });

    const result = await reader.decodeFromImageElement(img);
    return {
      format: readableFormat(result.getBarcodeFormat()),
      value: result.getText(),
      source: 'image',
    };
  } catch (err) {
    if (err instanceof NotFoundException) {
      throw new Error('No QR code or supported barcode was found in this image.');
    }
    throw new Error(
      err instanceof Error ? err.message : 'Could not decode the selected image.'
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

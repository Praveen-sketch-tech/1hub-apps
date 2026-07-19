// App #003 — QR & Barcode Studio
// Manages the lifecycle of the camera-based scanner: starts only on
// explicit user action, stops on demand, on unmount, and never leaves
// the camera running in the background.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { createReader, startCameraScan } from '../lib/scanner';
import type { ScanOutcome } from '../types';

export type CameraScannerStatus = 'idle' | 'starting' | 'scanning' | 'error';

export function useCameraScanner(onResult: (outcome: ScanOutcome) => void) {
  const [status, setStatus] = useState<CameraScannerStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const stop = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    if (!videoRef.current) return;
    setErrorMessage(null);
    setStatus('starting');

    if (!window.isSecureContext) {
      setStatus('error');
      setErrorMessage(
        'Camera access requires a secure (HTTPS) connection. This works on your production deployment; on localhost most browsers still allow it.'
      );
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('error');
      setErrorMessage('Camera scanning is not supported in this browser.');
      return;
    }

    try {
      const reader = createReader();
      const controls = await startCameraScan(
        reader,
        videoRef.current,
        (outcome) => {
          onResult(outcome);
        },
        (message) => {
          setErrorMessage(message);
        }
      );
      controlsRef.current = controls;
      setStatus('scanning');
    } catch (err) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Could not start the camera.';
      if (/permission/i.test(message) || (err as { name?: string })?.name === 'NotAllowedError') {
        setErrorMessage('Camera permission was denied. Please allow camera access and try again.');
      } else if (/NotFoundError/i.test((err as { name?: string })?.name ?? '')) {
        setErrorMessage('No camera was found on this device.');
      } else if (/NotReadableError/i.test((err as { name?: string })?.name ?? '')) {
        setErrorMessage('The camera is already in use by another application.');
      } else {
        setErrorMessage(message);
      }
    }
  }, [onResult]);

  // Always release the camera when the component unmounts.
  useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, []);

  return { videoRef, status, errorMessage, start, stop };
}

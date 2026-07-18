// App #003 — QR & Barcode Studio
// Camera-based scanner UI. Requests camera access only when the user
// explicitly presses Start, and always releases the camera on Stop or
// unmount.

import React, { useEffect, FC } from 'react';
import { useCameraScanner } from '../hooks/useCameraScanner';
import type { ScanOutcome } from '../types';
import { track } from '../lib/analytics';

interface CameraScannerProps {
  onResult: (outcome: ScanOutcome) => void;
}

const CameraScanner: FC<CameraScannerProps> = ({ onResult }) => {
  const { videoRef, status, errorMessage, start, stop } = useCameraScanner((outcome) => {
    onResult(outcome);
    stop();
    track(outcome.format === 'QR Code' ? 'qr_scanned' : 'barcode_scanned', {
      source: 'camera',
      format: outcome.format,
    });
  });

  // Stop the camera if this section unmounts (e.g. user switches tabs).
  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = () => {
    start();
    track('scanner_camera_started');
  };

  const handleStop = () => {
    stop();
    track('scanner_camera_stopped');
  };

  return (
    <div>
      <div className="qbs-scanner-video-wrap">
        <video ref={videoRef} className="qbs-scanner-video" muted playsInline />
      </div>

      <div className="qbs-btn-row">
        {status !== 'scanning' ? (
          <button type="button" className="qbs-btn" onClick={handleStart} disabled={status === 'starting'}>
            {status === 'starting' ? 'Starting…' : 'Start Scanner'}
          </button>
        ) : (
          <button type="button" className="qbs-btn qbs-btn-secondary" onClick={handleStop}>
            Stop Scanner
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="qbs-error" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default CameraScanner;

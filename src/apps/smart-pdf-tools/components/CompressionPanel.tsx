import { useState } from 'react';
import type { CompressionMode } from '../types';

interface CompressionPanelProps {
  onCompress: (mode: CompressionMode) => void;
  isProcessing: boolean;
  progressPercent?: number;
}

const MODES: { mode: CompressionMode; label: string; description: string }[] = [
  { mode: 'light', label: 'Light', description: 'High resolution, best quality, smaller savings.' },
  { mode: 'balanced', label: 'Balanced', description: 'Good quality with a solid size reduction. Recommended.' },
  { mode: 'strong', label: 'Strong', description: 'Maximum savings; noticeable quality loss on dense pages.' },
];

/**
 * Compression mode picker. Pairs with pdfCompression.ts's PROFILES —
 * the descriptions here are kept honest about trade-offs rather than
 * promising dramatic reduction for every file.
 */
export default function CompressionPanel({ onCompress, isProcessing, progressPercent }: CompressionPanelProps) {
  const [selected, setSelected] = useState<CompressionMode>('balanced');

  return (
    <div className="spt-compression-panel">
      <h2 className="spt-toolbar__heading">Compress PDF</h2>
      <p className="spt-field-hint">
        Compression re-renders each page as an image. Scanned or photo-heavy PDFs shrink the most; mostly-text
        documents may see smaller savings.
      </p>

      <div className="spt-compression-modes" role="radiogroup" aria-label="Compression mode">
        {MODES.map((m) => (
          <label key={m.mode} className={`spt-compression-mode ${selected === m.mode ? 'spt-compression-mode--active' : ''}`}>
            <input
              type="radio"
              name="spt-compression-mode"
              value={m.mode}
              checked={selected === m.mode}
              onChange={() => setSelected(m.mode)}
            />
            <span className="spt-compression-mode__label">{m.label}</span>
            <span className="spt-compression-mode__desc">{m.description}</span>
          </label>
        ))}
      </div>

      <button type="button" className="spt-btn spt-btn--primary" disabled={isProcessing} onClick={() => onCompress(selected)}>
        {isProcessing ? `Compressing… ${progressPercent ?? 0}%` : 'Compress PDF'}
      </button>
    </div>
  );
}

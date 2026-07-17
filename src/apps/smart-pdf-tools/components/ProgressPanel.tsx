import type { ProgressState } from '../types';

interface ProgressPanelProps {
  progress: ProgressState;
}

/**
 * Non-blocking progress indicator. Shown while files are being read/parsed
 * or an output is being generated so the user always sees current-step
 * text (and a percentage when available) instead of a frozen UI.
 */
export default function ProgressPanel({ progress }: ProgressPanelProps) {
  if (!progress.active) return null;

  return (
    <div className="spt-progress-panel" role="status" aria-live="polite">
      <span className="spt-spinner" aria-hidden="true" />
      <div className="spt-progress-panel__text">
        <span>{progress.label}</span>
        {typeof progress.percent === 'number' && (
          <div className="spt-progress-bar">
            <div className="spt-progress-bar__fill" style={{ width: `${progress.percent}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

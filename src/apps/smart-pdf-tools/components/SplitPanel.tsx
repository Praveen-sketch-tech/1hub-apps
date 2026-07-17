import { useMemo, useState } from 'react';
import { parseSplitRanges } from '../lib/splitRanges';

interface SplitPanelProps {
  totalPages: number;
  onSplit: (rangeInput: string) => void;
  isProcessing: boolean;
}

/**
 * Range input for the Split tool. Validates as the user types and shows
 * clear, non-crashing feedback for duplicate/reversed/out-of-bounds/invalid
 * input before the user commits to generating output.
 */
export default function SplitPanel({ totalPages, onSplit, isProcessing }: SplitPanelProps) {
  const [input, setInput] = useState('');

  const parsed = useMemo(() => parseSplitRanges(input, totalPages), [input, totalPages]);
  const hasUsableRanges = parsed.ranges.length > 0;

  return (
    <div className="spt-split-panel">
      <h2 className="spt-toolbar__heading">Split by page range</h2>
      <label className="spt-field-label" htmlFor="spt-split-input">
        Page ranges
      </label>
      <input
        id="spt-split-input"
        type="text"
        className="spt-text-input"
        placeholder="e.g. 1-3, 4-7, 8-10"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-describedby="spt-split-hint"
      />
      <p id="spt-split-hint" className="spt-field-hint">
        Document has {totalPages} page{totalPages === 1 ? '' : 's'}. Each range becomes its own PDF file.
      </p>

      {parsed.errors.length > 0 && (
        <ul className="spt-inline-errors" role="alert">
          {parsed.errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}

      {hasUsableRanges && (
        <p className="spt-split-panel__preview">
          Will generate {parsed.ranges.length} file{parsed.ranges.length === 1 ? '' : 's'}
          {parsed.ranges.length > 1 ? ' packaged as a ZIP.' : '.'}
        </p>
      )}

      <button
        type="button"
        className="spt-btn spt-btn--primary"
        disabled={!hasUsableRanges || isProcessing}
        onClick={() => onSplit(input)}
      >
        {isProcessing ? 'Splitting…' : 'Split PDF'}
      </button>
    </div>
  );
}

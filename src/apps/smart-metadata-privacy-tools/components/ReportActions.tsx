import React, { useState } from 'react';
import type { InspectionResult } from '../lib/types';
import { buildJsonReport, buildTextReport } from '../lib/report';
import { downloadText } from '../lib/download';

interface ReportActionsProps {
  result: InspectionResult;
}

const ReportActions: React.FC<ReportActionsProps> = ({ result }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildTextReport(result));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const baseName = result.file.name.replace(/\.[^/.]+$/, '') || 'file';

  return (
    <div className="smpt-actions">
      <button className="smpt-btn" onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy Metadata'}
      </button>
      <button className="smpt-btn" onClick={() => downloadText(buildTextReport(result), `${baseName}-metadata.txt`)}>
        Download TXT Report
      </button>
      <button
        className="smpt-btn"
        onClick={() => downloadText(buildJsonReport(result), `${baseName}-metadata.json`, 'application/json')}
      >
        Download JSON Report
      </button>
    </div>
  );
};

export default ReportActions;

import React from 'react';
import type { PrivacyRiskSummary } from '../lib/types';

interface PrivacyRiskPanelProps {
  privacy: PrivacyRiskSummary;
}

const RISK_LABEL: Record<PrivacyRiskSummary['overall'], string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
};

const PrivacyRiskPanel: React.FC<PrivacyRiskPanelProps> = ({ privacy }) => {
  return (
    <div>
      <div className={`smpt-risk-banner smpt-risk-banner--${privacy.overall}`}>
        <span>
          {RISK_LABEL[privacy.overall]}
          {privacy.flags.length > 0
            ? ` — ${privacy.flags.length} sensitive field${privacy.flags.length === 1 ? '' : 's'} found`
            : ' — no sensitive fields flagged'}
        </span>
      </div>
      {privacy.flags.length > 0 && (
        <ul className="smpt-flag-list">
          {privacy.flags.map((flag) => (
            <li className="smpt-flag" key={flag.key}>
              <span className={`smpt-flag__dot smpt-flag__dot--${flag.level}`} />
              <span>
                <strong>{flag.label}:</strong> {flag.reason}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PrivacyRiskPanel;

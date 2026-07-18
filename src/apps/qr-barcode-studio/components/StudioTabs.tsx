// App #003 — QR & Barcode Studio
// Generic accessible tab bar used for the top-level mode switcher
// (QR Generator / Barcode Generator / Scanner).

import React, { FC } from 'react';

export interface StudioTab {
  id: string;
  label: string;
}

interface StudioTabsProps {
  tabs: StudioTab[];
  activeId: string;
  onChange: (id: string) => void;
  idPrefix: string;
}

const StudioTabs: FC<StudioTabsProps> = ({ tabs, activeId, onChange, idPrefix }) => {
  return (
    <div className="qbs-tabs" role="tablist" aria-label="QR and Barcode Studio modes">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${tab.id}`}
          aria-selected={activeId === tab.id}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          className="qbs-tab"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default StudioTabs;

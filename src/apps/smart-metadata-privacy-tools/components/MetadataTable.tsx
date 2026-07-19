import React from 'react';
import type { MetadataGroup } from '../lib/types';

interface MetadataTableProps {
  groups: MetadataGroup[];
}

const MetadataTable: React.FC<MetadataTableProps> = ({ groups }) => {
  if (!groups.length) {
    return <p className="smpt-empty">No metadata fields were detected in this file.</p>;
  }

  return (
    <div>
      {groups.map((group) => (
        <div className="smpt-group" key={group.title}>
          <p className="smpt-group__title">{group.title}</p>
          {group.fields.map((field) => (
            <div className="smpt-field-row" key={field.key}>
              <span className="smpt-field-row__label">
                {field.label}
                {field.sensitive && <span className="smpt-badge smpt-badge--sensitive">Sensitive</span>}
              </span>
              <span className="smpt-field-row__value">{field.value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default MetadataTable;

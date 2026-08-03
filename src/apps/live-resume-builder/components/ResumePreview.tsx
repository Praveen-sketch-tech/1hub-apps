import React from 'react';
import { ResumeData, StyleConfig } from '../types/resume';

interface ResumePreviewProps {
  data: ResumeData;
  config: StyleConfig;
}

export const ResumePreview: React.FC<ResumePreviewProps> = ({ data, config }) => {
  const fontClass =
    config.fontFamily === 'serif'
      ? 'font-serif'
      : config.fontFamily === 'mono'
      ? 'font-mono'
      : 'font-sans';

  return (
    <div
      id="printable-resume"
      className={`bg-white text-gray-900 p-8 shadow-lg rounded-xl border border-gray-200 min-h-[842px] text-xs leading-relaxed ${fontClass}`}
    >
      <div className="border-b-2 pb-4 mb-4" style={{ borderColor: config.themeColor }}>
        <h1 className="text-2xl font-bold uppercase tracking-wide" style={{ color: config.themeColor }}>
          {data.personal.fullName || 'Your Name'}
        </h1>
        <p className="text-sm font-medium text-gray-600">{data.personal.jobTitle || 'Your Target Role'}</p>
        <div className="flex flex-wrap gap-3 text-gray-500 mt-2">
          {data.personal.email && <span>{data.personal.email}</span>}
          {data.personal.phone && <span>• {data.personal.phone}</span>}
          {data.personal.location && <span>• {data.personal.location}</span>}
        </div>
      </div>

      {data.personal.summary && (
        <div className="mb-4">
          <h2 className="font-bold text-xs uppercase tracking-wider mb-1" style={{ color: config.themeColor }}>
            Summary
          </h2>
          <p className="text-gray-700">{data.personal.summary}</p>
        </div>
      )}

      {data.experiences.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-xs uppercase tracking-wider mb-2" style={{ color: config.themeColor }}>
            Work Experience
          </h2>
          <div className="space-y-3">
            {data.experiences.map((exp) => (
              <div key={exp.id}>
                <div className="flex justify-between font-semibold">
                  <span>{exp.role} — <span className="text-gray-600">{exp.company}</span></span>
                  <span className="text-gray-500">{exp.startDate} – {exp.endDate}</span>
                </div>
                <p className="text-gray-700 mt-0.5">{exp.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.skills.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-xs uppercase tracking-wider mb-2" style={{ color: config.themeColor }}>
            Skills & Core Competencies
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {data.skills.map((skill, index) => (
              <span
                key={index}
                className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
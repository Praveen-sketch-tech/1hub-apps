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
      {/* Header */}
      <div className="border-b-2 pb-4 mb-4 text-center" style={{ borderColor: config.themeColor }}>
        <h1 className="text-2xl font-extrabold uppercase tracking-wider" style={{ color: config.themeColor }}>
          {data.personal.fullName || 'Praveen Laxkar'}
        </h1>
        {data.personal.jobTitle && (
          <p className="text-xs font-bold text-gray-700 mt-1 uppercase tracking-wide">{data.personal.jobTitle}</p>
        )}
        <div className="text-gray-600 mt-2 space-y-0.5 text-[11px]">
          {data.personal.location && <p>{data.personal.location}</p>}
          <p className="font-medium">
            {data.personal.email && <span>E-mail: {data.personal.email}</span>}
            {data.personal.phone && <span className="ml-3">Contact: {data.personal.phone}</span>}
          </p>
        </div>
      </div>

      {/* Summary / Objective */}
      {data.personal.summary && (
        <div className="mb-4">
          <h2 className="font-bold text-xs uppercase tracking-wider mb-1 border-b pb-0.5" style={{ color: config.themeColor, borderColor: config.themeColor }}>
            CAREER OBJECTIVE
          </h2>
          <p className="text-gray-800 leading-normal mt-1">{data.personal.summary}</p>
        </div>
      )}

      {/* Work Experience */}
      {data.experiences && data.experiences.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-xs uppercase tracking-wider mb-2 border-b pb-0.5" style={{ color: config.themeColor, borderColor: config.themeColor }}>
            EXPERIENCE
          </h2>
          <div className="space-y-3">
            {data.experiences.map((exp) => (
              <div key={exp.id}>
                <div className="flex justify-between font-bold text-gray-900">
                  <span>{exp.role} <span className="font-semibold text-gray-700">@ {exp.company}</span></span>
                  <span className="text-gray-600 text-[11px] font-medium">{exp.startDate} – {exp.endDate}</span>
                </div>
                {exp.description && (
                  <p className="text-gray-700 mt-1 leading-normal pl-3 border-l-2 border-gray-200">{exp.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {data.skills && data.skills.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-xs uppercase tracking-wider mb-2 border-b pb-0.5" style={{ color: config.themeColor, borderColor: config.themeColor }}>
            COMMUNICATIVE & TECHNICAL SKILLS
          </h2>
          <ul className="list-disc list-inside space-y-1 text-gray-800 pl-1">
            {data.skills.map((skill, index) => (
              <li key={index} className="leading-snug">{skill}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Education */}
      {data.education && data.education.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-xs uppercase tracking-wider mb-2 border-b pb-0.5" style={{ color: config.themeColor, borderColor: config.themeColor }}>
            ACADEMIC QUALIFICATION
          </h2>
          <div className="space-y-1.5">
            {data.education.map((edu) => (
              <div key={edu.id} className="flex justify-between items-start text-gray-800">
                <div>
                  <span className="font-bold">{edu.degree}</span> — <span>{edu.institution}</span>
                </div>
                <span className="text-gray-600 text-[11px] font-medium">{edu.startDate} – {edu.endDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Details */}
      {data.details && (
        <div className="mb-4">
          <h2 className="font-bold text-xs uppercase tracking-wider mb-2 border-b pb-0.5" style={{ color: config.themeColor, borderColor: config.themeColor }}>
            ADDITIONAL INFORMATION
          </h2>
          <div className="grid grid-cols-2 gap-y-1 text-gray-800">
            {data.details.dob && <p><span className="font-semibold">Date of Birth:</span> {data.details.dob}</p>}
            {data.details.fatherName && <p><span className="font-semibold">Father's Name:</span> {data.details.fatherName}</p>}
            {data.details.languages && <p><span className="font-semibold">Spoken Languages:</span> {data.details.languages}</p>}
          </div>
        </div>
      )}

      {/* Formal Declaration */}
      {data.details?.showDeclaration && (
        <div className="mt-6 pt-3 border-t border-gray-200">
          <h2 className="font-bold text-xs uppercase tracking-wider mb-1 text-gray-700">DECLARATION</h2>
          <p className="text-gray-700 italic">
            "I {data.personal.fullName || 'Praveen Laxkar'} s/o {data.details?.fatherName || 'Mr. Ashok Laxkar'} hereby declare that all the information in this resume is correct to the best of my knowledge."
          </p>
          <div className="flex justify-between items-end mt-4 pt-2 text-gray-800">
            <div>
              <p><span className="font-semibold">Date:</span> ____________</p>
              <p><span className="font-semibold">Place:</span> {data.details?.declarationPlace || 'Indore'}</p>
            </div>
            <div className="text-right font-bold text-gray-900 border-t border-gray-400 pt-1 px-4">
              {data.personal.fullName || 'Praveen Laxkar'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

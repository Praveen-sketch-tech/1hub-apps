import React, { useState } from 'react';
import { ResumeData, Experience } from '../types/resume';

interface ResumeFormProps {
  data: ResumeData;
  onChange: (newData: ResumeData) => void;
}

export const ResumeForm: React.FC<ResumeFormProps> = ({ data, onChange }) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'experience' | 'skills'>('personal');

  const updatePersonal = (key: keyof ResumeData['personal'], value: string) => {
    onChange({
      ...data,
      personal: { ...data.personal, [key]: value }
    });
  };

  const addExperience = () => {
    const newExp: Experience = {
      id: Date.now().toString(),
      company: '',
      role: '',
      startDate: '',
      endDate: '',
      location: '',
      description: ''
    };
    onChange({ ...data, experiences: [...data.experiences, newExp] });
  };

  const updateExperience = (id: string, key: keyof Experience, value: string) => {
    onChange({
      ...data,
      experiences: data.experiences.map((exp) => (exp.id === id ? { ...exp, [key]: value } : exp))
    });
  };

  const removeExperience = (id: string) => {
    onChange({
      ...data,
      experiences: data.experiences.filter((exp) => exp.id !== id)
    });
  };

  const handleSkillsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const skillArray = e.target.value.split(',').map((s) => s.trimStart());
    onChange({ ...data, skills: skillArray });
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 gap-2 overflow-x-auto">
        {(['personal', 'experience', 'skills'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-semibold capitalize whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'personal' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Full Name</label>
            <input
              type="text"
              value={data.personal.fullName}
              onChange={(e) => updatePersonal('fullName', e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Job Title</label>
            <input
              type="text"
              value={data.personal.jobTitle}
              onChange={(e) => updatePersonal('jobTitle', e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Email</label>
            <input
              type="email"
              value={data.personal.email}
              onChange={(e) => updatePersonal('email', e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Phone</label>
            <input
              type="text"
              value={data.personal.phone}
              onChange={(e) => updatePersonal('phone', e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Professional Summary</label>
            <textarea
              rows={3}
              value={data.personal.summary}
              onChange={(e) => updatePersonal('summary', e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      )}

      {activeTab === 'experience' && (
        <div className="space-y-4">
          {data.experiences.map((exp) => (
            <div key={exp.id} className="p-4 border rounded-lg border-gray-200 dark:border-gray-700 text-xs space-y-3 relative">
              <button
                onClick={() => removeExperience(exp.id)}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold"
              >
                ✕
              </button>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Company"
                  value={exp.company}
                  onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                  className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <input
                  placeholder="Role"
                  value={exp.role}
                  onChange={(e) => updateExperience(exp.id, 'role', e.target.value)}
                  className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <input
                  placeholder="Start Date (e.g. 2022-01)"
                  value={exp.startDate}
                  onChange={(e) => updateExperience(exp.id, 'startDate', e.target.value)}
                  className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <input
                  placeholder="End Date (or Present)"
                  value={exp.endDate}
                  onChange={(e) => updateExperience(exp.id, 'endDate', e.target.value)}
                  className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <textarea
                placeholder="Key Achievements & Responsibilities"
                rows={2}
                value={exp.description}
                onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          ))}
          <button
            onClick={addExperience}
            className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300 rounded-lg hover:border-blue-500 transition"
          >
            + Add Experience
          </button>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="text-xs">
          <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
            Skills (Comma separated)
          </label>
          <input
            type="text"
            value={data.skills.join(', ')}
            onChange={handleSkillsChange}
            placeholder="React, TypeScript, Underwriting, Python, Tailwind"
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
          />
        </div>
      )}
    </div>
  );
};
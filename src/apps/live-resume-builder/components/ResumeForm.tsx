import React, { useState } from 'react';
import { ResumeData, Experience, Education } from '../types/resume';

interface ResumeFormProps {
  data: ResumeData;
  onChange: (newData: ResumeData) => void;
}

export const ResumeForm: React.FC<ResumeFormProps> = ({ data, onChange }) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'experience' | 'education' | 'skills' | 'details'>('personal');

  const updatePersonal = (key: keyof ResumeData['personal'], value: string) => {
    onChange({
      ...data,
      personal: { ...data.personal, [key]: value }
    });
  };

  const updateDetails = (key: keyof ResumeData['details'], value: any) => {
    onChange({
      ...data,
      details: { ...data.details, [key]: value }
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

  const addEducation = () => {
    const newEdu: Education = {
      id: Date.now().toString(),
      institution: '',
      degree: '',
      startDate: '',
      endDate: '',
      score: ''
    };
    onChange({ ...data, education: [...(data.education || []), newEdu] });
  };

  const updateEducation = (id: string, key: keyof Education, value: string) => {
    onChange({
      ...data,
      education: (data.education || []).map((edu) => (edu.id === id ? { ...edu, [key]: value } : edu))
    });
  };

  const removeEducation = (id: string) => {
    onChange({
      ...data,
      education: (data.education || []).filter((edu) => edu.id !== id)
    });
  };

  const handleSkillsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const skillArray = e.target.value.split(',').map((s) => s.trimStart());
    onChange({ ...data, skills: skillArray });
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 gap-2 overflow-x-auto">
        {(['personal', 'experience', 'education', 'skills', 'details'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-semibold capitalize whitespace-nowrap border-b-2 transition-colors ${
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
            <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Contact No(s)</label>
            <input
              type="text"
              value={data.personal.phone}
              onChange={(e) => updatePersonal('phone', e.target.value)}
              placeholder="+91-9039871369, 8770124163"
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Full Address</label>
            <input
              type="text"
              value={data.personal.location}
              onChange={(e) => updatePersonal('location', e.target.value)}
              placeholder="1078, Shanti Colony, Near Railway Station, Dalauda, Mandsaur (M.P.) - 458667"
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Career Objective / Summary</label>
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
                  placeholder="Company / Organization"
                  value={exp.company}
                  onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                  className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <input
                  placeholder="Role / Designation"
                  value={exp.role}
                  onChange={(e) => updateExperience(exp.id, 'role', e.target.value)}
                  className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <input
                  placeholder="Start Date (e.g. July 2023)"
                  value={exp.startDate}
                  onChange={(e) => updateExperience(exp.id, 'startDate', e.target.value)}
                  className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <input
                  placeholder="End Date (e.g. Till Date)"
                  value={exp.endDate}
                  onChange={(e) => updateExperience(exp.id, 'endDate', e.target.value)}
                  className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <textarea
                placeholder="Key Responsibilities & Accomplishments"
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

      {activeTab === 'education' && (
        <div className="space-y-4">
          {(data.education || []).map((edu) => (
            <div key={edu.id} className="p-4 border rounded-lg border-gray-200 dark:border-gray-700 text-xs space-y-3 relative">
              <button
                onClick={() => removeEducation(edu.id)}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold"
              >
                ✕
              </button>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Degree / Qualification"
                  value={edu.degree}
                  onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                  className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <input
                  placeholder="Board / University"
                  value={edu.institution}
                  onChange={(e) => updateEducation(edu.id, 'institution', e.target.value)}
                  className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <input
                  placeholder="Start Year"
                  value={edu.startDate}
                  onChange={(e) => updateEducation(edu.id, 'startDate', e.target.value)}
                  className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <input
                  placeholder="End Year / Result"
                  value={edu.endDate}
                  onChange={(e) => updateEducation(edu.id, 'endDate', e.target.value)}
                  className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
          ))}
          <button
            onClick={addEducation}
            className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300 rounded-lg hover:border-blue-500 transition"
          >
            + Add Academic Qualification
          </button>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="text-xs">
          <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
            Skills & Software (Comma separated)
          </label>
          <input
            type="text"
            value={data.skills.join(', ')}
            onChange={handleSkillsChange}
            placeholder="Credit Operations, MIS, Typing 46 WPM, MS Office, HTML, CSS"
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
          />
        </div>
      )}

      {activeTab === 'details' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Date of Birth</label>
            <input
              type="text"
              value={data.details?.dob || ''}
              onChange={(e) => updateDetails('dob', e.target.value)}
              placeholder="18.01.1998"
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Father's Name</label>
            <input
              type="text"
              value={data.details?.fatherName || ''}
              onChange={(e) => updateDetails('fatherName', e.target.value)}
              placeholder="Mr. Ashok Laxkar"
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Languages Known</label>
            <input
              type="text"
              value={data.details?.languages || ''}
              onChange={(e) => updateDetails('languages', e.target.value)}
              placeholder="English and Hindi"
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Declaration Place</label>
            <input
              type="text"
              value={data.details?.declarationPlace || ''}
              onChange={(e) => updateDetails('declarationPlace', e.target.value)}
              placeholder="Indore"
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="showDecl"
              checked={data.details?.showDeclaration ?? true}
              onChange={(e) => updateDetails('showDeclaration', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="showDecl" className="font-medium text-gray-700 dark:text-gray-300">
              Show Formal Declaration Section at bottom
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

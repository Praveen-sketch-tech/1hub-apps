import React, { useState } from 'react';
import { ResumeData, StyleConfig } from './types/resume';
import { sampleResumeData } from './lib/sampleResumeData';
import { StyleControls } from './components/StyleControls';
import { ResumeForm } from './components/ResumeForm';
import { ResumePreview } from './components/ResumePreview';
import './live-resume-builder.css';

export const LiveResumeBuilderPage: React.FC = () => {
  const [resumeData, setResumeData] = useState<ResumeData>(sampleResumeData);
  const [styleConfig, setStyleConfig] = useState<StyleConfig>({
    themeColor: '#2563eb',
    fontFamily: 'sans',
    template: 'modern'
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(resumeData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${resumeData.personal.fullName || 'resume'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          setResumeData(parsed);
        } catch (err) {
          alert('Invalid JSON file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Live Resume & Portfolio Studio</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Design ATS-friendly modern resumes with live print preview.</p>
        </header>

        <StyleControls
          config={styleConfig}
          onChange={setStyleConfig}
          onLoadSample={() => setResumeData(sampleResumeData)}
          onReset={() => setResumeData({ personal: { fullName: '', jobTitle: '', email: '', phone: '', location: '', website: '', linkedin: '', github: '', summary: '' }, experiences: [], education: [], skills: [], projects: [] })}
          onExportJSON={handleExportJSON}
          onImportJSON={handleImportJSON}
          onPrint={handlePrint}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="no-print">
            <ResumeForm data={resumeData} onChange={setResumeData} />
          </div>
          <div>
            <ResumePreview data={resumeData} config={styleConfig} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveResumeBuilderPage;
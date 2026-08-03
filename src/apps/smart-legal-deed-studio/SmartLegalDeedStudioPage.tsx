import React, { useState } from 'react';
import { DeedFormData, StyleConfig, PartyProfile } from './types/deed';
import { defaultFormData, initialPartyProfiles } from './lib/sampleLegalData';
import { DeedForm } from './components/DeedForm';
import { DeedPreview } from './components/DeedPreview';
import { PartyBookModal } from './components/PartyBookModal';
import './smart-legal-deed-studio.css';

export const SmartLegalDeedStudioPage: React.FC = () => {
  const [formData, setFormData] = useState<DeedFormData>(defaultFormData);
  const [partyProfiles, setPartyProfiles] = useState<PartyProfile[]>(initialPartyProfiles);
  const [styleConfig, setStyleConfig] = useState<StyleConfig>({
    themeColor: '#1e3a8a',
    stampSpaceMM: 30,
    fontSize: 'base'
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<'A' | 'B'>('A');

  const handleOpenPartyBook = (role: 'A' | 'B') => {
    setActiveRole(role);
    setIsModalOpen(true);
  };

  const handleSelectProfile = (profile: PartyProfile, role: 'A' | 'B') => {
    if (role === 'A') {
      setFormData((prev) => ({
        ...prev,
        partyAId: profile.id,
        partyAName: profile.name,
        partyAFatherName: profile.fatherName || '',
        partyAAddress: profile.address,
        partyAPhone: profile.phone
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        partyBId: profile.id,
        partyBName: profile.name,
        partyBFatherName: profile.fatherName || '',
        partyBAddress: profile.address,
        partyBPhone: profile.phone
      }));
    }
  };

  const handleAddProfile = (newProfile: PartyProfile) => {
    setPartyProfiles((prev) => [...prev, newProfile]);
  };

  const handleReset = () => {
    setFormData(defaultFormData);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Smart Business Contract & Legal Deed Studio</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Generate legal deeds, rental agreements & contracts with Party Profile Book support.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg border dark:border-gray-700 text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Stamp Space:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={styleConfig.stampSpaceMM}
                onChange={(e) => setStyleConfig({ ...styleConfig, stampSpaceMM: Number(e.target.value) })}
                className="w-24"
              />
              <span className="font-bold text-blue-600">{styleConfig.stampSpaceMM} mm</span>
            </div>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow transition"
            >
              Print / Save PDF
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="no-print">
            <DeedForm
              data={formData}
              onChange={setFormData}
              onOpenPartyBook={handleOpenPartyBook}
              onReset={handleReset}
            />
          </div>
          <div>
            <DeedPreview data={formData} config={styleConfig} />
          </div>
        </div>

        <PartyBookModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          profiles={partyProfiles}
          onAddProfile={handleAddProfile}
          onSelectProfile={handleSelectProfile}
          activeRole={activeRole}
        />
      </div>
    </div>
  );
};

export default SmartLegalDeedStudioPage;
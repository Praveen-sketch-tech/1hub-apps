import React from 'react';
import { DeedFormData, CategoryType, LanguageType } from '../types/deed';
import { CATEGORIES, TEMPLATES } from '../lib/templateRegistry';

interface DeedFormProps {
  data: DeedFormData;
  onChange: (newData: DeedFormData) => void;
  onOpenPartyBook: (role: 'A' | 'B') => void;
  onReset: () => void;
}

export const DeedForm: React.FC<DeedFormProps> = ({ data, onChange, onOpenPartyBook, onReset }) => {
  const updateField = (key: keyof DeedFormData, value: any) => {
    onChange({ ...data, [key]: value });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategory = e.target.value as CategoryType;
    const firstTemplate = TEMPLATES[newCategory]?.[0]?.id || '';
    onChange({ ...data, category: newCategory, templateId: firstTemplate });
  };

  const activeTemplates = TEMPLATES[data.category] || [];

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-xs space-y-6">
      {/* Category & Template Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <label className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">Document Category</label>
          <select
            value={data.category}
            onChange={handleCategoryChange}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-medium"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nameEn} / {cat.nameHi}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">Select Template</label>
          <select
            value={data.templateId}
            onChange={(e) => updateField('templateId', e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-medium text-blue-700 dark:text-blue-400"
          >
            {activeTemplates.map((t: any) => (
              <option key={t.id} value={t.id}>{t.nameEn} / {t.nameHi}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <label className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">Output Language</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateField('language', 'hi')}
              className={`px-3 py-1 rounded font-bold transition ${data.language === 'hi' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            >
              हिन्दी (Hindi)
            </button>
            <button
              type="button"
              onClick={() => updateField('language', 'en')}
              className={`px-3 py-1 rounded font-bold transition ${data.language === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            >
              English
            </button>
          </div>
        </div>
        <button type="button" onClick={onReset} className="px-3 py-1 border border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50 rounded transition font-medium">
          Reset Form
        </button>
      </div>

      {/* Party A Inputs */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">First Party (प्रथम पक्ष)</h3>
          <button type="button" onClick={() => onOpenPartyBook('A')} className="text-blue-600 font-semibold hover:underline">📖 Select Profile</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Full Name" value={data.partyAName} onChange={(e) => updateField('partyAName', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          <input placeholder="Father's / Husband's Name" value={data.partyAFatherName || ''} onChange={(e) => updateField('partyAFatherName', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          <input placeholder="Phone Number" value={data.partyAPhone} onChange={(e) => updateField('partyAPhone', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          <input placeholder="Full Address" value={data.partyAAddress} onChange={(e) => updateField('partyAAddress', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
        </div>
      </div>

      {/* Party B Inputs */}
      <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">Second Party (द्वितीय पक्ष)</h3>
          <button type="button" onClick={() => onOpenPartyBook('B')} className="text-blue-600 font-semibold hover:underline">📖 Select Profile</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Full Name" value={data.partyBName} onChange={(e) => updateField('partyBName', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          <input placeholder="Father's / Husband's Name" value={data.partyBFatherName || ''} onChange={(e) => updateField('partyBFatherName', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          <input placeholder="Phone Number" value={data.partyBPhone} onChange={(e) => updateField('partyBPhone', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          <input placeholder="Full Address" value={data.partyBAddress} onChange={(e) => updateField('partyBAddress', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
        </div>
      </div>

      {/* Transaction Values */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">Key Details & Amounts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input placeholder="Amount (₹) (Rent/Loan/Deal)" value={data.financialAmount || ''} onChange={(e) => updateField('financialAmount', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          <input placeholder="Deposit (₹)" value={data.securityDeposit || ''} onChange={(e) => updateField('securityDeposit', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          <input placeholder="Duration (Months)" value={data.durationMonths || ''} onChange={(e) => updateField('durationMonths', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          <input placeholder="Execution Date" type="date" value={data.executionDate} onChange={(e) => updateField('executionDate', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
          <input placeholder="Execution Place (City)" value={data.executionPlace} onChange={(e) => updateField('executionPlace', e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
        </div>
        <input placeholder="Subject Property / Business Name" value={data.propertyAddress || ''} onChange={(e) => updateField('propertyAddress', e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
      </div>
    </div>
  );
};

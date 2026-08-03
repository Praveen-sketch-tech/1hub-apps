import React from 'react';
import { DeedFormData, CategoryType, LanguageType } from '../types/deed';

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

  const updateClause = (clauseKey: keyof DeedFormData['clauses'], value: any) => {
    onChange({
      ...data,
      clauses: { ...data.clauses, [clauseKey]: value }
    });
  };

  const addCustomClause = () => {
    const custom = prompt('Enter custom clause details:');
    if (custom) {
      onChange({
        ...data,
        clauses: {
          ...data.clauses,
          customClauses: [...data.clauses.customClauses, custom]
        }
      });
    }
  };

  const removeCustomClause = (index: number) => {
    onChange({
      ...data,
      clauses: {
        ...data.clauses,
        customClauses: data.clauses.customClauses.filter((_, i) => i !== index)
      }
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-xs space-y-6">
      {/* Language & Category Selection */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <label className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">Language (भाषा)</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateField('language', 'hi')}
              className={`px-3 py-1 rounded font-bold transition ${
                data.language === 'hi' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              हिन्दी (Hindi)
            </button>
            <button
              type="button"
              onClick={() => updateField('language', 'en')}
              className={`px-3 py-1 rounded font-bold transition ${
                data.language === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              English
            </button>
          </div>
        </div>

        <div>
          <label className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">Document Category</label>
          <select
            value={data.category}
            onChange={(e) => updateField('category', e.target.value as CategoryType)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-medium"
          >
            <option value="property">Property Documents (किराया / संपत्ति)</option>
            <option value="business">Business Agreements (व्यापारिक अनुबंध)</option>
            <option value="loan">Loan & Finance (ऋण / प्रॉमिसरी)</option>
            <option value="affidavits">Affidavits (शपथ पत्र)</option>
            <option value="employment">Employment / HR</option>
            <option value="notices">Legal Notices</option>
            <option value="family">Family Documents</option>
            <option value="other">Other Contracts</option>
          </select>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1 border border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50 rounded transition font-medium"
        >
          Reset Form
        </button>
      </div>

      {/* Party A Inputs */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            First Party (प्रथम पक्ष / Owner / Lender)
          </h3>
          <button
            type="button"
            onClick={() => onOpenPartyBook('A')}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            📖 Select from Party Book
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            placeholder="Full Name"
            value={data.partyAName}
            onChange={(e) => updateField('partyAName', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            placeholder="Father's / Husband's Name"
            value={data.partyAFatherName || ''}
            onChange={(e) => updateField('partyAFatherName', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            placeholder="Phone Number"
            value={data.partyAPhone}
            onChange={(e) => updateField('partyAPhone', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            placeholder="Full Address"
            value={data.partyAAddress}
            onChange={(e) => updateField('partyAAddress', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
      </div>

      {/* Party B Inputs */}
      <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            Second Party (द्वितीय पक्ष / Tenant / Borrower)
          </h3>
          <button
            type="button"
            onClick={() => onOpenPartyBook('B')}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            📖 Select from Party Book
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            placeholder="Full Name"
            value={data.partyBName}
            onChange={(e) => updateField('partyBName', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            placeholder="Father's / Husband's Name"
            value={data.partyBFatherName || ''}
            onChange={(e) => updateField('partyBFatherName', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            placeholder="Phone Number"
            value={data.partyBPhone}
            onChange={(e) => updateField('partyBPhone', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            placeholder="Full Address"
            value={data.partyBAddress}
            onChange={(e) => updateField('partyBAddress', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
      </div>

      {/* Key Transaction Values */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
          Key Details & Amounts
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            placeholder="Rent / Loan Amount (₹)"
            value={data.financialAmount || ''}
            onChange={(e) => updateField('financialAmount', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            placeholder="Security Deposit (₹)"
            value={data.securityDeposit || ''}
            onChange={(e) => updateField('securityDeposit', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            placeholder="Duration (Months)"
            value={data.durationMonths || ''}
            onChange={(e) => updateField('durationMonths', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            placeholder="Execution Date"
            type="date"
            value={data.executionDate}
            onChange={(e) => updateField('executionDate', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            placeholder="Execution Place (City)"
            value={data.executionPlace}
            onChange={(e) => updateField('executionPlace', e.target.value)}
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <input
          placeholder="Property / Subject Premises Address"
          value={data.propertyAddress || ''}
          onChange={(e) => updateField('propertyAddress', e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
        />
      </div>

      {/* Checkbox Extra Clauses */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
          Standard Clauses & Options
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.clauses.maintenance}
              onChange={(e) => updateClause('maintenance', e.target.checked)}
            />
            Maintenance Included
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.clauses.electricityBill}
              onChange={(e) => updateClause('electricityBill', e.target.checked)}
            />
            Electricity Extra
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.clauses.waterBill}
              onChange={(e) => updateClause('waterBill', e.target.checked)}
            />
            Water Bill Extra
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.clauses.latePaymentPenalty}
              onChange={(e) => updateClause('latePaymentPenalty', e.target.checked)}
            />
            Late Payment Penalty
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.clauses.lockInPeriod}
              onChange={(e) => updateClause('lockInPeriod', e.target.checked)}
            />
            Lock-in Period
          </label>
        </div>

        {/* Custom Clauses */}
        <div className="pt-2">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-gray-700 dark:text-gray-300">Custom Clauses:</span>
            <button
              type="button"
              onClick={addCustomClause}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Add Custom Clause
            </button>
          </div>
          {data.clauses.customClauses.map((c, i) => (
            <div key={i} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded mb-1">
              <span>{i + 1}. {c}</span>
              <button onClick={() => removeCustomClause(i)} className="text-red-500 font-bold ml-2">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
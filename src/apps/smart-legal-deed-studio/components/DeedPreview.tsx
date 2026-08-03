import React from 'react';
import { DeedFormData, StyleConfig } from '../types/deed';
import { TEMPLATES } from '../lib/templateRegistry';

interface DeedPreviewProps {
  data: DeedFormData;
  config: StyleConfig;
}

export const DeedPreview: React.FC<DeedPreviewProps> = ({ data, config }) => {
  const isHi = data.language === 'hi';

  // Find Active Template from Registry
  const categoryTemplates = TEMPLATES[data.category] || [];
  const activeTemplate = categoryTemplates.find(t => t.id === data.templateId) || categoryTemplates[0];

  // Dynamic Content Parser
  const parseContent = (text: string | undefined) => {
    if (!text) return '';
    return text
      .replace(/\{\{date\}\}/g, data.executionDate ? new Date(data.executionDate).toLocaleDateString(isHi ? 'hi-IN' : 'en-GB') : '________')
      .replace(/\{\{place\}\}/g, data.executionPlace || '________')
      .replace(/\{\{partyA\}\}/g, data.partyAName || '________')
      .replace(/\{\{partyB\}\}/g, data.partyBName || '________')
      .replace(/\{\{amount\}\}/g, data.financialAmount || '________')
      .replace(/\{\{deposit\}\}/g, data.securityDeposit || '________')
      .replace(/\{\{duration\}\}/g, data.durationMonths || '________')
      .replace(/\{\{propertyAddress\}\}/g, data.propertyAddress || '________')
      .replace(/\{\{partyAddress\}\}/g, data.partyAAddress || '________'); // Specific for affidavits
  };

  const docTitle = isHi ? activeTemplate?.nameHi : activeTemplate?.nameEn;
  const docBody = isHi ? activeTemplate?.contentHi : activeTemplate?.contentEn;

  return (
    <div
      id="printable-deed"
      className="bg-white text-gray-900 p-10 shadow-lg rounded-xl border border-gray-200 min-h-[842px] text-xs leading-relaxed font-serif relative"
    >
      {/* Watermark/Stamp Placeholder */}
      <div style={{ height: `${config.stampSpaceMM}mm` }} className="border-b border-dashed border-gray-300 mb-6 flex items-center justify-center text-gray-400 text-[10px] no-print">
        --- Non-Judicial Stamp Paper Space ({config.stampSpaceMM} mm) ---
      </div>

      <div className="text-center font-bold text-base uppercase tracking-wider mb-8 pb-2 border-b-2" style={{ borderColor: config.themeColor }}>
        {docTitle || 'LEGAL DOCUMENT'}
      </div>

      <div className="mb-6 text-justify text-[13px] leading-loose text-gray-800">
        {parseContent(docBody) || 'Please select a valid template category to generate document body.'}
      </div>

      {/* Detailed Party Identification (Shows globally if not an affidavit) */}
      {data.category !== 'affidavits' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded">
            <p className="font-bold text-gray-900 mb-1 border-b pb-1">{isHi ? 'प्रथम पक्ष विवरण' : 'First Party Details'}</p>
            <p className="font-semibold">{data.partyAName || '________'}</p>
            {data.partyAFatherName && <p className="text-gray-600">S/o: {data.partyAFatherName}</p>}
            <p className="text-gray-700 mt-1">{data.partyAAddress || '________'}</p>
            <p className="text-gray-600 mt-1">Phone: {data.partyAPhone || '________'}</p>
          </div>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded">
            <p className="font-bold text-gray-900 mb-1 border-b pb-1">{isHi ? 'द्वितीय पक्ष विवरण' : 'Second Party Details'}</p>
            <p className="font-semibold">{data.partyBName || '________'}</p>
            {data.partyBFatherName && <p className="text-gray-600">S/o: {data.partyBFatherName}</p>}
            <p className="text-gray-700 mt-1">{data.partyBAddress || '________'}</p>
            <p className="text-gray-600 mt-1">Phone: {data.partyBPhone || '________'}</p>
          </div>
        </div>
      )}

      {/* Standard Clauses Section */}
      <div className="space-y-2 mb-6 text-[13px]">
        <p className="font-bold border-b pb-1 mb-2">{isHi ? 'अन्य शर्तें एवं नियम (Standard Clauses):' : 'STANDARD TERMS & CONDITIONS:'}</p>
        <ol className="list-decimal list-inside space-y-1.5 text-gray-800">
          {data.clauses.maintenance && <li>{isHi ? 'परिसर/व्यापार का रखरखाव शुल्क संबंधित पक्ष द्वारा वहन किया जाएगा।' : 'Maintenance obligations shall be borne by the respective party.'}</li>}
          {data.clauses.electricityBill && <li>{isHi ? 'बिजली / उपयोगिता बिल का भुगतान वास्तविक खपत अनुसार पृथक से देय होगा।' : 'Utility and electricity charges shall be paid extra as per actual usage.'}</li>}
          {data.clauses.latePaymentPenalty && <li>{isHi ? 'भुगतान में विलंब होने पर पूर्व निर्धारित पेनल्टी / हर्ज़ाना लागू होगा।' : 'Late payments will be subject to mutually agreed default penalty.'}</li>}
          {data.clauses.lockInPeriod && <li>{isHi ? 'इस अनुबंध में एक न्यूनतम लॉक-इन (Lock-in) अवधि अनिवार्य है, जिसके पूर्व अनुबंध रद्द नहीं किया जा सकता।' : 'A minimum lock-in period is strictly applicable to this agreement.'}</li>}
          {data.clauses.customClauses.map((c, idx) => (
            <li key={idx}>{c}</li>
          ))}
        </ol>
      </div>

      {/* Signatures */}
      <div className="mt-16 pt-6 border-t border-gray-300">
        <div className="flex justify-between items-end mb-12">
          <div className="text-center font-bold">
            <p className="border-t border-gray-400 pt-1 px-8">{data.partyAName || '________'}</p>
            <p className="text-[10px] text-gray-500 font-normal mt-1">{isHi ? '(प्रथम पक्ष हस्ताक्षर)' : '(First Party Signature)'}</p>
          </div>
          {data.category !== 'affidavits' && (
            <div className="text-center font-bold">
              <p className="border-t border-gray-400 pt-1 px-8">{data.partyBName || '________'}</p>
              <p className="text-[10px] text-gray-500 font-normal mt-1">{isHi ? '(द्वितीय पक्ष हस्ताक्षर)' : '(Second Party Signature)'}</p>
            </div>
          )}
        </div>

        <div className="flex justify-between text-gray-700 text-[11px]">
          <div>
            <p className="font-semibold">{isHi ? 'साक्षी 1 (Witness 1):' : 'Witness 1:'}</p>
            <p className="mt-1">नाम: {data.witnessAName || '________________'}</p>
            <p className="mt-1">हस्ताक्षर: ________________</p>
          </div>
          <div>
            <p className="font-semibold">{isHi ? 'साक्षी 2 (Witness 2):' : 'Witness 2:'}</p>
            <p className="mt-1">नाम: {data.witnessBName || '________________'}</p>
            <p className="mt-1">हस्ताक्षर: ________________</p>
          </div>
        </div>
      </div>
    </div>
  );
};

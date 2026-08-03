import React from 'react';
import { DeedFormData, StyleConfig } from '../types/deed';

interface DeedPreviewProps {
  data: DeedFormData;
  config: StyleConfig;
}

export const DeedPreview: React.FC<DeedPreviewProps> = ({ data, config }) => {
  const isHi = data.language === 'hi';

  const getDocTitle = () => {
    switch (data.category) {
      case 'property':
        return isHi ? 'किरायानामा एवं लीज अनुबंध (RENTAL AGREEMENT)' : 'RENTAL & LEASE AGREEMENT';
      case 'business':
        return isHi ? 'व्यापारिक साझेदारी विलेख (PARTNERSHIP DEED)' : 'BUSINESS PARTNERSHIP DEED';
      case 'loan':
        return isHi ? 'ऋण स्वीकृति अनुबंध एवं प्रॉमिसरी नोट' : 'LOAN AGREEMENT & PROMISSORY NOTE';
      case 'affidavits':
        return isHi ? 'सामान्य शपथ पत्र (GENERAL AFFIDAVIT)' : 'GENERAL AFFIDAVIT';
      case 'employment':
        return isHi ? 'रोजगार एवं सेवा अनुबंध (EMPLOYMENT CONTRACT)' : 'EMPLOYMENT & SERVICE CONTRACT';
      case 'notices':
        return isHi ? 'विधिक सूचना प्रपत्र (LEGAL NOTICE)' : 'LEGAL NOTICE FORM';
      default:
        return isHi ? 'सामान्य अनुबंध एवं इकरारनामा' : 'GENERAL CONTRACT AGREEMENT';
    }
  };

  return (
    <div
      id="printable-deed"
      className="bg-white text-gray-900 p-10 shadow-lg rounded-xl border border-gray-200 min-h-[842px] text-xs leading-relaxed font-serif"
    >
      {/* Stamp Paper Blank Space Header */}
      <div style={{ height: `${config.stampSpaceMM}mm` }} className="border-b border-dashed border-gray-300 mb-4 flex items-center justify-center text-gray-400 text-[10px] no-print">
        --- Non-Judicial Stamp Paper Space ({config.stampSpaceMM} mm) ---
      </div>

      {/* Dynamic Document Title */}
      <div className="text-center font-bold text-base uppercase tracking-wider mb-6 pb-2 border-b-2" style={{ borderColor: config.themeColor }}>
        {getDocTitle()}
      </div>

      {/* Document Execution Body */}
      <p className="mb-4 text-justify">
        {isHi ? (
          <>
            यह दस्तावेज़/अनुबंध आज दिनांक <b>{data.executionDate || '________'}</b> को स्थान <b>{data.executionPlace || '________'}</b> में निम्नलिखित पक्षों के मध्य निष्पादित किया गया:
          </>
        ) : (
          <>
            This Legal Document / Contract is made and executed on <b>{data.executionDate || '________'}</b> at <b>{data.executionPlace || '________'}</b> by and between:
          </>
        )}
      </p>

      {/* First Party Details */}
      <div className="mb-3 pl-4 border-l-2 border-blue-600">
        <p className="font-bold text-gray-900">
          1. {data.partyAName || '________'} {data.partyAFatherName ? `(आ. / पति: ${data.partyAFatherName})` : ''}
        </p>
        <p className="text-gray-700">{data.partyAAddress || '________'}</p>
        <p className="text-gray-600">संपर्क / Contact: {data.partyAPhone || '________'}</p>
        <p className="font-semibold text-gray-800 italic mt-0.5">
          ({isHi ? 'प्रथम पक्ष / Disclosing Party / First Party' : 'FIRST PARTY'})
        </p>
      </div>

      {/* Second Party Details */}
      <div className="mb-4 pl-4 border-l-2 border-emerald-600">
        <p className="font-bold text-gray-900">
          2. {data.partyBName || '________'} {data.partyBFatherName ? `(आ. / पति: ${data.partyBFatherName})` : ''}
        </p>
        <p className="text-gray-700">{data.partyBAddress || '________'}</p>
        <p className="text-gray-600">संपर्क / Contact: {data.partyBPhone || '________'}</p>
        <p className="font-semibold text-gray-800 italic mt-0.5">
          ({isHi ? 'द्वितीय पक्ष / Receiving Party / Second Party' : 'SECOND PARTY'})
        </p>
      </div>

      {/* Category Specific Premises or Purpose */}
      {data.propertyAddress && (
        <div className="mb-4 p-2 bg-gray-50 border border-gray-200 rounded">
          <p className="font-bold">{isHi ? 'विषय संपत्ति / व्यवसाय / प्रयोजन का विवरण:' : 'SUBJECT PROPERTY / PURPOSE DETAILS:'}</p>
          <p>{data.propertyAddress}</p>
        </div>
      )}

      {/* Category Specific Clauses */}
      <div className="space-y-2 mb-6">
        <p className="font-bold border-b pb-1">{isHi ? 'मुख्य शर्तें एवं नियम (Terms & Conditions):' : 'TERMS AND CONDITIONS:'}</p>
        <ol className="list-decimal list-inside space-y-1 text-gray-800">
          {data.financialAmount && (
            <li>
              {isHi
                ? `यह कि तय की गई मुख्य वित्तीय राशि ₹${data.financialAmount} है, जो तय समयसीमा में देय होगी।`
                : `That the agreed financial transaction/rent/loan value is ₹${data.financialAmount}.`}
            </li>
          )}
          {data.securityDeposit && (
            <li>
              {isHi
                ? `यह कि सुरक्षा/अमानत राशि के रूप में ₹${data.securityDeposit} निष्पादित किए गए हैं।`
                : `That an amount of ₹${data.securityDeposit} is deposited/agreed as security.`}
            </li>
          )}
          {data.durationMonths && (
            <li>
              {isHi
                ? `यह अनुबंध/विलेख कुल ${data.durationMonths} माह की अवधि के लिए लागू माना जावेगा।`
                : `That this contract shall remain valid for a tenure of ${data.durationMonths} months.`}
            </li>
          )}
          {data.clauses.maintenance && (
            <li>{isHi ? 'रखरखाव (Maintenance) संबंधी दायित्व शामिल रहेंगे।' : 'Maintenance obligations are included in this agreement.'}</li>
          )}
          {data.clauses.electricityBill && (
            <li>{isHi ? 'उपयोगिता बिल (Utility Bills) का भुगतान पृथक से देय होगा।' : 'Utility charges shall be paid extra as per actual usage.'}</li>
          )}
          {data.clauses.latePaymentPenalty && (
            <li>{isHi ? 'भुगतान में विलंब होने पर नियमानुसार पेनल्टी/हर्ज़ाना लागू होगा।' : 'Late payments will be subject to mutually agreed default penalty.'}</li>
          )}
          {data.clauses.customClauses.map((c, idx) => (
            <li key={idx}>{c}</li>
          ))}
        </ol>
      </div>

      {/* Signatures & Witness Block */}
      <div className="mt-12 pt-4 border-t border-gray-300">
        <div className="flex justify-between items-end mb-12">
          <div className="text-center font-bold">
            <p className="border-t border-gray-400 pt-1 px-6">{data.partyAName}</p>
            <p className="text-[10px] font-normal">{isHi ? 'प्रथम पक्ष के हस्ताक्षर' : 'Signature of First Party'}</p>
          </div>
          <div className="text-center font-bold">
            <p className="border-t border-gray-400 pt-1 px-6">{data.partyBName}</p>
            <p className="text-[10px] font-normal">{isHi ? 'द्वितीय पक्ष के हस्ताक्षर' : 'Signature of Second Party'}</p>
          </div>
        </div>

        <div className="flex justify-between text-gray-700 text-[11px]">
          <div>
            <p className="font-semibold">{isHi ? 'साक्षी 1 (Witness 1):' : 'Witness 1:'}</p>
            <p>नाम: {data.witnessAName || '________________'}</p>
            <p>हस्ताक्षर: ________________</p>
          </div>
          <div>
            <p className="font-semibold">{isHi ? 'साक्षी 2 (Witness 2):' : 'Witness 2:'}</p>
            <p>नाम: {data.witnessBName || '________________'}</p>
            <p>हस्ताक्षर: ________________</p>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { DeedFormData, StyleConfig } from '../types/deed';

interface DeedPreviewProps {
  data: DeedFormData;
  config: StyleConfig;
}

export const DeedPreview: React.FC<DeedPreviewProps> = ({ data, config }) => {
  const isHi = data.language === 'hi';

  return (
    <div
      id="printable-deed"
      className="bg-white text-gray-900 p-10 shadow-lg rounded-xl border border-gray-200 min-h-[842px] text-xs leading-relaxed font-serif"
    >
      {/* Stamp Paper Blank Space Header Adjustment */}
      <div style={{ height: `${config.stampSpaceMM}mm` }} className="border-b border-dashed border-gray-300 mb-4 flex items-center justify-center text-gray-400 text-[10px] no-print">
        --- Non-Judicial Stamp Paper Space ({config.stampSpaceMM} mm) ---
      </div>

      {/* Document Title */}
      <div className="text-center font-bold text-base uppercase tracking-wider mb-6 pb-2 border-b-2" style={{ borderColor: config.themeColor }}>
        {isHi ? 'इकरारनामा / किरायानामा अनुबंध' : 'LEGAL RENTAL & LEASE AGREEMENT'}
      </div>

      {/* Document Execution Clause */}
      <p className="mb-4 text-justify">
        {isHi ? (
          <>
            यह अनुबंध आज दिनांक <b>{data.executionDate || '________'}</b> को <b>{data.executionPlace || '________'}</b> में निम्नलिखित पक्षों के मध्य निष्पादित किया गया:
          </>
        ) : (
          <>
            This Agreement is made and executed on this <b>{data.executionDate || '________'}</b> at <b>{data.executionPlace || '________'}</b> by and between:
          </>
        )}
      </p>

      {/* First Party */}
      <div className="mb-3 pl-4 border-l-2 border-blue-600">
        <p className="font-bold text-gray-900">
          1. {data.partyAName || '________'} {data.partyAFatherName ? `(आ. / पति: ${data.partyAFatherName})` : ''}
        </p>
        <p className="text-gray-700">{data.partyAAddress || '________'}</p>
        <p className="text-gray-600">संपर्क / Contact: {data.partyAPhone || '________'}</p>
        <p className="font-semibold text-gray-800 italic mt-0.5">
          ({isHi ? 'जिसे प्रथम पक्ष / मकान मालिक कहा जावेगा' : 'Hereinafter called the FIRST PARTY / LANDLORD'})
        </p>
      </div>

      {/* Second Party */}
      <div className="mb-4 pl-4 border-l-2 border-emerald-600">
        <p className="font-bold text-gray-900">
          2. {data.partyBName || '________'} {data.partyBFatherName ? `(आ. / पति: ${data.partyBFatherName})` : ''}
        </p>
        <p className="text-gray-700">{data.partyBAddress || '________'}</p>
        <p className="text-gray-600">संपर्क / Contact: {data.partyBPhone || '________'}</p>
        <p className="font-semibold text-gray-800 italic mt-0.5">
          ({isHi ? 'जिसे द्वितीय पक्ष / किराएदार कहा जावेगा' : 'Hereinafter called the SECOND PARTY / TENANT'})
        </p>
      </div>

      {/* Premises Details */}
      {data.propertyAddress && (
        <div className="mb-4 p-2 bg-gray-50 border border-gray-200 rounded">
          <p className="font-bold">{isHi ? 'संपत्ति / परिसर का विवरण:' : 'PROPERTY PREMISES DETAILS:'}</p>
          <p>{data.propertyAddress}</p>
        </div>
      )}

      {/* Terms & Conditions */}
      <div className="space-y-2 mb-6">
        <p className="font-bold border-b pb-1">{isHi ? 'अनुबंध की शर्तें एवं नियम:' : 'TERMS AND CONDITIONS:'}</p>
        <ol className="list-decimal list-inside space-y-1 text-gray-800">
          <li>
            {isHi
              ? `यह कि परिसर का मासिक किराया ₹${data.financialAmount || '______'} तय किया गया है, जो प्रति माह देय होगा।`
              : `That the monthly rent for the premises is agreed at ₹${data.financialAmount || '______'} per month.`}
          </li>
          <li>
            {isHi
              ? `यह कि द्वितीय पक्ष द्वारा प्रथम पक्ष के पास ₹${data.securityDeposit || '______'} अमानत/सुरक्षा राशि के रूप में जमा रखी गई है।`
              : `That the Second Party has deposited ₹${data.securityDeposit || '______'} as interest-free security deposit.`}
          </li>
          <li>
            {isHi
              ? `यह अनुबंध कुल ${data.durationMonths || '11'} माह की अवधि के लिए मान्य रहेगा।`
              : `That this agreement shall be valid for a duration of ${data.durationMonths || '11'} months.`}
          </li>
          {data.clauses.maintenance && (
            <li>{isHi ? 'रखरखाव (Maintenance) शुल्क किराए में शामिल है।' : 'Maintenance charges are included in monthly rent.'}</li>
          )}
          {data.clauses.electricityBill && (
            <li>{isHi ? 'बिजली बिल की अदायगी मीटर रीडिंग अनुसार द्वितीय पक्ष द्वारा पृथक से की जावेगी।' : 'Electricity bill shall be paid extra by the Second Party as per meter reading.'}</li>
          )}
          {data.clauses.latePaymentPenalty && (
            <li>{isHi ? 'किराया विलंब से देने पर नियमानुसार हर्ज़ाना देय होगा।' : 'Late rent payment will attract standard default penalty.'}</li>
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
            <p className="text-[10px] font-normal">{isHi ? 'प्रथम पक्ष (स्वामित्व)' : 'First Party (Owner)'}</p>
          </div>
          <div className="text-center font-bold">
            <p className="border-t border-gray-400 pt-1 px-6">{data.partyBName}</p>
            <p className="text-[10px] font-normal">{isHi ? 'द्वितीय पक्ष (किराएदार)' : 'Second Party (Tenant)'}</p>
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
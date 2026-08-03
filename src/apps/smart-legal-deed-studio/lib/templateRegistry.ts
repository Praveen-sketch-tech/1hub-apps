export const CATEGORIES = [
  { id: 'property', nameHi: 'संपत्ति (Property Documents)', nameEn: 'Property Documents' },
  { id: 'business', nameHi: 'व्यापार (Business Agreements)', nameEn: 'Business Agreements' },
  { id: 'loan', nameHi: 'ऋण (Loan & Finance)', nameEn: 'Loan & Finance' },
  { id: 'affidavits', nameHi: 'शपथ पत्र (Affidavits)', nameEn: 'Affidavits' },
  { id: 'employment', nameHi: 'रोजगार (Employment / HR)', nameEn: 'Employment / HR' },
  { id: 'notices', nameHi: 'विधिक सूचना (Legal Notices)', nameEn: 'Legal Notices' },
  { id: 'family', nameHi: 'पारिवारिक (Family Documents)', nameEn: 'Family Documents' },
  { id: 'other', nameHi: 'अन्य (Other Documents)', nameEn: 'Other Documents' }
];

export const TEMPLATES: Record<string, any[]> = {
  property: [
    { 
      id: 'rent-agreement', 
      nameHi: 'किरायानामा (Rent Agreement)', 
      nameEn: 'Rental Agreement',
      contentHi: 'यह किरायानामा दिनांक {{date}} को {{place}} में {{partyA}} (प्रथम पक्ष/मकान मालिक) और {{partyB}} (द्वितीय पक्ष/किराएदार) के मध्य निष्पादित किया गया है। संपत्ति "{{propertyAddress}}" का मासिक किराया ₹{{amount}} तय हुआ है तथा सुरक्षा निधि के रूप में ₹{{deposit}} जमा किए गए हैं।',
      contentEn: 'This Rental Agreement is executed on {{date}} at {{place}} between {{partyA}} (First Party/Landlord) and {{partyB}} (Second Party/Tenant). The monthly rent for the property located at "{{propertyAddress}}" is agreed at ₹{{amount}} with a security deposit of ₹{{deposit}}.'
    },
    { 
      id: 'sale-agreement', 
      nameHi: 'बयाना / इकरारनामा (Sale Agreement)', 
      nameEn: 'Agreement to Sell',
      contentHi: 'यह इकरारनामा दिनांक {{date}} को {{place}} में {{partyA}} (विक्रेता) और {{partyB}} (क्रेता) के मध्य संपत्ति "{{propertyAddress}}" के विक्रय हेतु निष्पादित किया गया है। कुल सौदा ₹{{amount}} में तय हुआ है।',
      contentEn: 'This Agreement to Sell is executed on {{date}} at {{place}} between {{partyA}} (Seller) and {{partyB}} (Purchaser) for the property located at "{{propertyAddress}}". The total sale consideration is fixed at ₹{{amount}}.'
    }
  ],
  business: [
    { 
      id: 'partnership-deed', 
      nameHi: 'साझेदारी विलेख (Partnership Deed)', 
      nameEn: 'Partnership Deed',
      contentHi: 'यह साझेदारी विलेख दिनांक {{date}} को {{place}} में {{partyA}} और {{partyB}} के मध्य व्यापारिक उद्देश्यों के लिए निष्पादित किया गया है। दोनों पक्षों की आपसी सहमति से व्यवसाय का संचालन किया जाएगा।',
      contentEn: 'This Partnership Deed is executed on {{date}} at {{place}} between {{partyA}} and {{partyB}} for conducting joint business operations under mutually agreed terms.'
    },
    { 
      id: 'nda', 
      nameHi: 'गोपनीयता समझौता (NDA)', 
      nameEn: 'Non-Disclosure Agreement (NDA)',
      contentHi: 'यह गोपनीयता समझौता दिनांक {{date}} को {{partyA}} (Disclosing Party) और {{partyB}} (Receiving Party) के मध्य गोपनीय जानकारी सुरक्षित रखने हेतु किया गया है।',
      contentEn: 'This Non-Disclosure Agreement is made on {{date}} between {{partyA}} (Disclosing Party) and {{partyB}} (Receiving Party) to protect confidential business information.'
    }
  ],
  loan: [
    { 
      id: 'promissory-note', 
      nameHi: 'प्रॉमिसरी नोट (Promissory Note)', 
      nameEn: 'Promissory Note',
      contentHi: 'मैं {{partyB}}, {{partyA}} से ₹{{amount}} का ऋण प्राप्त करने की पुष्टि करता हूँ और वचन देता हूँ कि मैं यह राशि तय सीमा {{duration}} माह के भीतर वापस करूँगा।',
      contentEn: 'I, {{partyB}}, acknowledge the receipt of ₹{{amount}} as a loan from {{partyA}} and promise to repay the same within a period of {{duration}} months.'
    }
  ],
  affidavits: [
    { 
      id: 'general-affidavit', 
      nameHi: 'सामान्य शपथ पत्र', 
      nameEn: 'General Affidavit',
      contentHi: 'मैं {{partyA}}, निवासी {{partyAddress}}, शपथ पूर्वक घोषणा करता/करती हूँ कि मेरे द्वारा दी गई सभी जानकारी सत्य एवं सही है।',
      contentEn: 'I, {{partyA}}, residing at {{partyAddress}}, do hereby solemnly affirm and declare that all the information provided by me is true and correct.'
    }
  ],
  employment: [
    { 
      id: 'employment-contract', 
      nameHi: 'रोजगार अनुबंध (Employment Contract)', 
      nameEn: 'Employment Contract',
      contentHi: 'यह रोजगार अनुबंध दिनांक {{date}} को नियोक्ता {{partyA}} और कर्मचारी {{partyB}} के मध्य निष्पादित किया गया। वेतन ₹{{amount}} प्रतिमाह निर्धारित किया गया है।',
      contentEn: 'This Employment Contract is executed on {{date}} between Employer {{partyA}} and Employee {{partyB}}. The monthly remuneration is fixed at ₹{{amount}}.'
    }
  ],
  notices: [
    { 
      id: 'legal-notice', 
      nameHi: 'विधिक सूचना (Legal Notice)', 
      nameEn: 'Legal Notice',
      contentHi: 'प्रेषक {{partyA}} की ओर से, प्राप्तकर्ता {{partyB}} को यह विधिक सूचना दी जाती है कि वे {{duration}} माह के भीतर बकाया राशि ₹{{amount}} का भुगतान करें।',
      contentEn: 'On behalf of {{partyA}}, this Legal Notice is served to {{partyB}} to clear the outstanding dues of ₹{{amount}} within {{duration}} months.'
    }
  ],
  family: [
    { 
      id: 'family-settlement', 
      nameHi: 'पारिवारिक समझौता (Family Settlement)', 
      nameEn: 'Family Settlement Deed',
      contentHi: 'यह पारिवारिक समझौता दिनांक {{date}} को {{place}} में {{partyA}} और {{partyB}} के मध्य संपत्ति "{{propertyAddress}}" के शांतिपूर्ण बंटवारे हेतु किया गया है।',
      contentEn: 'This Family Settlement Deed is executed on {{date}} at {{place}} between {{partyA}} and {{partyB}} for the peaceful distribution of the property located at "{{propertyAddress}}".'
    }
  ],
  other: [
    { 
      id: 'general-contract', 
      nameHi: 'सामान्य इकरारनामा (General Contract)', 
      nameEn: 'General Contract Agreement',
      contentHi: 'यह सामान्य अनुबंध दिनांक {{date}} को {{place}} में {{partyA}} और {{partyB}} के मध्य निष्पादित किया गया है।',
      contentEn: 'This General Contract is executed on {{date}} at {{place}} between {{partyA}} and {{partyB}}.'
    }
  ]
};

import { DeedFormData, PartyProfile } from '../types/deed';

export const initialPartyProfiles: PartyProfile[] = [
  {
    id: 'p1',
    name: 'Praveen Laxkar',
    fatherName: 'Mr. Ashok Laxkar',
    type: 'Person',
    phone: '+91 9039871369',
    address: '1078, Shanti Colony, Near Railway Station, Dalauda, Mandsaur (M.P.) - 458667'
  },
  {
    id: 'p2',
    name: 'Vishnu Dubey',
    fatherName: 'Mr. R. K. Dubey',
    type: 'Person',
    phone: '+91 9876543210',
    address: 'Main Market, Mandsaur, Madhya Pradesh - 458001'
  }
];

export const defaultFormData: DeedFormData = {
  category: 'property',
  templateId: 'rent-agreement',
  language: 'hi',
  partyAName: 'Praveen Laxkar',
  partyAFatherName: 'Mr. Ashok Laxkar',
  partyAAddress: '1078, Shanti Colony, Dalauda, Mandsaur (M.P.)',
  partyAPhone: '+91 9039871369',
  partyBName: 'Vishnu Dubey',
  partyBFatherName: 'Mr. R. K. Dubey',
  partyBAddress: 'Main Market, Mandsaur (M.P.)',
  partyBPhone: '+91 9876543210',
  witnessAName: 'Ramesh Sharma',
  witnessBName: 'Suresh Verma',
  executionDate: '2026-08-01',
  executionPlace: 'Mandsaur',
  financialAmount: '12000',
  securityDeposit: '24000',
  propertyAddress: 'Shop No. 4, Commercial Complex, Mandsaur (M.P.)',
  durationMonths: '11',
  clauses: {
    maintenance: true,
    electricityBill: true,
    waterBill: true,
    latePaymentPenalty: true,
    lockInPeriod: true,
    parking: false,
    petsAllowed: false,
    customClauses: ['दोनों पक्ष आपसी सहमति से 1 माह का नोटिस देकर यह अनुबंध समाप्त कर सकते हैं।']
  }
};
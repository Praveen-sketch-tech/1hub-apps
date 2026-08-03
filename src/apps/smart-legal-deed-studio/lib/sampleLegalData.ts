import { DeedFormData, PartyProfile } from '../types/deed';

export const initialPartyProfiles: PartyProfile[] = [
  {
    id: 'p1',
    name: 'Rajesh Kumar',
    fatherName: 'Mr. Suresh Kumar',
    type: 'Person',
    phone: '+91 9876543210',
    address: '123, Civil Lines, Mandsaur (M.P.) - 458001'
  },
  {
    id: 'p2',
    name: 'Amit Sharma',
    fatherName: 'Mr. Ramesh Sharma',
    type: 'Person',
    phone: '+91 9123456789',
    address: '45, Station Road, Indore (M.P.) - 452001'
  }
];

export const defaultFormData: DeedFormData = {
  category: 'property',
  templateId: 'rent-agreement',
  language: 'hi',
  partyAName: 'Rajesh Kumar',
  partyAFatherName: 'Mr. Suresh Kumar',
  partyAAddress: '123, Civil Lines, Mandsaur (M.P.)',
  partyAPhone: '+91 9876543210',
  partyBName: 'Amit Sharma',
  partyBFatherName: 'Mr. Ramesh Sharma',
  partyBAddress: '45, Station Road, Indore (M.P.)',
  partyBPhone: '+91 9123456789',
  witnessAName: 'Verma Ji',
  witnessBName: 'Gupta Ji',
  executionDate: '2026-08-01',
  executionPlace: 'Mandsaur',
  financialAmount: '10000',
  securityDeposit: '20000',
  propertyAddress: 'Shop No. 12, Main Road Market, Mandsaur (M.P.)',
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

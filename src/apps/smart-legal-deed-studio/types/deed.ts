export type CategoryType = 
  | 'property' 
  | 'business' 
  | 'loan' 
  | 'affidavits' 
  | 'employment' 
  | 'notices' 
  | 'family' 
  | 'other';

export type LanguageType = 'hi' | 'en';

export interface PartyProfile {
  id: string;
  name: string;
  fatherName?: string;
  type: 'Person' | 'Company' | 'Witness';
  phone: string;
  address: string;
  idNumber?: string;
}

export interface ExtraClauses {
  maintenance: boolean;
  electricityBill: boolean;
  waterBill: boolean;
  latePaymentPenalty: boolean;
  lockInPeriod: boolean;
  parking: boolean;
  petsAllowed: boolean;
  customClauses: string[];
}

export interface DeedFormData {
  category: CategoryType;
  templateId: string;
  language: LanguageType;
  partyAId?: string;
  partyAName: string;
  partyAFatherName?: string;
  partyAAddress: string;
  partyAPhone: string;
  partyBId?: string;
  partyBName: string;
  partyBFatherName?: string;
  partyBAddress: string;
  partyBPhone: string;
  witnessAName?: string;
  witnessBName?: string;
  executionDate: string;
  executionPlace: string;
  financialAmount?: string;
  securityDeposit?: string;
  propertyAddress?: string;
  durationMonths?: string;
  clauses: ExtraClauses;
  editableCustomDocumentBody?: string;
}

export interface StyleConfig {
  themeColor: string;
  stampSpaceMM: number;
  fontSize: 'sm' | 'base' | 'lg';
}
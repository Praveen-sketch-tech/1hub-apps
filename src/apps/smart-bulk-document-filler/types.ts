export type DocKind = 'docx' | 'xlsx' | 'pdf-form' | 'pdf-text' | 'unsupported';

export interface ParagraphModel {
  index: number;
  text: string;
  bold: boolean;
  align: 'left' | 'center' | 'right' | 'justify';
  headingLevel: 0 | 1 | 2 | 3;
  isLabelValue: boolean;
  label?: string;
  value?: string;
}

export interface CellRef {
  sheetName: string;
  ref: string; // e.g. "B4"
  label: string;
  value: string;
}

export interface PdfFieldRef {
  name: string;
  value: string;
}

export interface ParsedDocument {
  fileName: string;
  kind: DocKind;
  paragraphs?: ParagraphModel[];
  cells?: CellRef[];
  pdfFields?: PdfFieldRef[];
  unsupportedReason?: string;
}

export interface FieldPair {
  docIndex: number;
  fileName: string;
  refId: string; // paragraph index / cell ref / pdf field name, used to locate it later
  rawLabel: string;
  normalizedLabel: string;
  value: string;
}

export interface FieldGroup {
  id: string;
  displayLabel: string;
  normalizedLabel: string;
  occurrences: FieldPair[];
  suggestedValue: string;
  confidence: number; // % of occurrences that agree with the suggested value
  varies: boolean; // true if values differ too much to be a "reusable" field
}

export interface SavedProfileField {
  normalizedLabel: string;
  displayLabel: string;
  value: string;
}

export interface FillFormField {
  groupId: string;
  displayLabel: string;
  value: string;
}

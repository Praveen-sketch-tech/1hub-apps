import { parseAnyDocument } from './documentDispatcher';
import { groupFields } from './fieldExtractor';
import { saveProfile } from './profileStore';
import type { FieldGroup, ParsedDocument } from '../types';

export interface LearnResult {
  parsedDocs: ParsedDocument[];
  fieldGroups: FieldGroup[];
  savedFieldCount: number;
}

const REUSABLE_MIN_CONFIDENCE = 50;
const REUSABLE_MIN_OCCURRENCES = 2;

export async function learnFromDocuments(files: File[]): Promise<LearnResult> {
  const parsedDocs: ParsedDocument[] = [];
  const allFields: import('../types').FieldPair[] = [];

  for (let i = 0; i < files.length; i++) {
    const { doc, fields } = await parseAnyDocument(files[i], i);
    parsedDocs.push(doc);
    allFields.push(...fields);
  }

  const fieldGroups = groupFields(allFields);

  const reusable = fieldGroups.filter(
    (g) => !g.varies && g.confidence >= REUSABLE_MIN_CONFIDENCE && g.occurrences.length >= REUSABLE_MIN_OCCURRENCES && g.suggestedValue
  );

  saveProfile(
    reusable.map((g) => ({
      normalizedLabel: g.normalizedLabel,
      displayLabel: g.displayLabel,
      value: g.suggestedValue
    }))
  );

  return { parsedDocs, fieldGroups, savedFieldCount: reusable.length };
}

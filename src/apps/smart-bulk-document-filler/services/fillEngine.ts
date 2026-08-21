import { parseAnyDocument } from './documentDispatcher';
import { groupFields } from './fieldExtractor';
import { loadProfile, findProfileValue } from './profileStore';
import { fillDocx, parseDocx } from './docxEngine';
import { fillXlsx } from './xlsxEngine';
import { fillPdfForm } from './pdfFormEngine';
import { renderParagraphsAsPdf } from './pdfExport';
import type { ParsedDocument, FieldGroup, FillFormField, DocKind } from '../types';

export interface FillSession {
  files: File[];
  parsedDocs: ParsedDocument[];
  fieldGroups: FieldGroup[];
  formFields: FillFormField[];
  unsupportedFiles: { fileName: string; reason: string }[];
}

export async function scanForFill(files: File[]): Promise<FillSession> {
  const parsedDocs: ParsedDocument[] = [];
  const allFields: import('../types').FieldPair[] = [];
  const unsupportedFiles: { fileName: string; reason: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const { doc, fields } = await parseAnyDocument(files[i], i);
    parsedDocs.push(doc);
    allFields.push(...fields);
    if (doc.kind === 'unsupported') {
      unsupportedFiles.push({ fileName: doc.fileName, reason: doc.unsupportedReason || 'Unsupported file.' });
    }
  }

  const fieldGroups = groupFields(allFields);
  const profile = loadProfile();

  const formFields: FillFormField[] = fieldGroups.map((g) => ({
    groupId: g.id,
    displayLabel: g.displayLabel,
    value: g.suggestedValue || findProfileValue(profile, g.normalizedLabel) || ''
  }));

  return { files, parsedDocs, fieldGroups, formFields, unsupportedFiles };
}

export interface GeneratedFile {
  fileName: string;
  blob: Blob;
  originalKind: DocKind;
}

export type OutputFormat = 'original' | 'pdf';

export async function generateFilledDocuments(
  session: FillSession,
  editedValues: Map<string, string>,
  outputFormat: OutputFormat
): Promise<GeneratedFile[]> {
  const results: GeneratedFile[] = [];

  for (let docIndex = 0; docIndex < session.files.length; docIndex++) {
    const file = session.files[docIndex];
    const doc = session.parsedDocs[docIndex];
    if (doc.kind === 'unsupported') continue;

    const docReplacements = new Map<string, string>();
    session.fieldGroups.forEach((group) => {
      const newValue = editedValues.get(group.id);
      if (newValue === undefined) return;
      group.occurrences.forEach((occ) => {
        if (occ.docIndex === docIndex) {
          docReplacements.set(occ.refId, newValue);
        }
      });
    });

    if (doc.kind === 'docx') {
      const numericReplacements = new Map<number, string>();
      docReplacements.forEach((v, k) => {
        const idx = parseInt(k, 10);
        if (!Number.isNaN(idx)) numericReplacements.set(idx, v);
      });
      const filledBlob = await fillDocx(file, numericReplacements);

      if (outputFormat === 'pdf') {
        const filledFileLike = new File([filledBlob], file.name);
        const updatedModel = await parseDocx(filledFileLike);
        const pdfBlob = await renderParagraphsAsPdf(updatedModel.paragraphs);
        results.push({ fileName: swapExtension(file.name, 'pdf'), blob: pdfBlob, originalKind: 'docx' });
      } else {
        results.push({ fileName: file.name, blob: filledBlob, originalKind: 'docx' });
      }
      continue;
    }

    if (doc.kind === 'xlsx') {
      const filledBlob = await fillXlsx(file, docReplacements);
      results.push({ fileName: file.name, blob: filledBlob, originalKind: 'xlsx' });
      continue;
    }

    if (doc.kind === 'pdf-form') {
      const filledBlob = await fillPdfForm(file, docReplacements);
      results.push({ fileName: file.name, blob: filledBlob, originalKind: 'pdf-form' });
      continue;
    }

    if (doc.kind === 'pdf-text') {
      const paragraphs = (doc.paragraphs || []).map((paragraph) => {
        const replacement = docReplacements.get(String(paragraph.index));

        if (replacement === undefined || !paragraph.isLabelValue) {
          return paragraph;
        }

        return {
          ...paragraph,
          text: `${paragraph.label || ''}: ${replacement}`,
          value: replacement
        };
      });

      const filledBlob = await renderParagraphsAsPdf(paragraphs);

      results.push({
        fileName: file.name,
        blob: filledBlob,
        originalKind: 'pdf-text'
      });

      continue;
    }
  }

  return results;
}

function swapExtension(fileName: string, newExt: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot >= 0 ? fileName.slice(0, dot) : fileName;
  return `${base}.${newExt}`;
}

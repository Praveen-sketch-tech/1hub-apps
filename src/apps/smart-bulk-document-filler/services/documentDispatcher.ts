import { parseDocx } from './docxEngine';
import { parseXlsx } from './xlsxEngine';
import { parsePdfForm } from './pdfFormEngine';
import { parsePdfText } from './pdfTextEngine';
import type { ParsedDocument, FieldPair } from '../types';
import { normalizeLabel } from './fieldExtractor';

export async function parseAnyDocument(file: File, docIndex: number): Promise<{ doc: ParsedDocument; fields: FieldPair[] }> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.docx')) {
    try {
      const model = await parseDocx(file);
      const fields: FieldPair[] = model.paragraphs
        .filter((p) => p.isLabelValue)
        .map((p) => ({
          docIndex,
          fileName: file.name,
          refId: String(p.index),
          rawLabel: p.label!,
          normalizedLabel: normalizeLabel(p.label!),
          value: (p.value || '').trim()
        }));
      return { doc: { fileName: file.name, kind: 'docx', paragraphs: model.paragraphs }, fields };
    } catch (err) {
      return {
        doc: { fileName: file.name, kind: 'unsupported', unsupportedReason: err instanceof Error ? err.message : 'Failed to parse .docx' },
        fields: []
      };
    }
  }

  if (name.endsWith('.xlsx')) {
    try {
      const model = await parseXlsx(file);
      const fields: FieldPair[] = model.cells.map((c) => ({
        docIndex,
        fileName: file.name,
        refId: `${c.sheetName}::${c.ref}`,
        rawLabel: c.label,
        normalizedLabel: normalizeLabel(c.label),
        value: c.value.trim()
      }));
      return { doc: { fileName: file.name, kind: 'xlsx', cells: model.cells }, fields };
    } catch (err) {
      return {
        doc: { fileName: file.name, kind: 'unsupported', unsupportedReason: err instanceof Error ? err.message : 'Failed to parse .xlsx' },
        fields: []
      };
    }
  }

  if (name.endsWith('.pdf')) {
    try {
      // First try a real fillable PDF form.
      const formModel = await parsePdfForm(file);

      if (formModel) {
        const fields: FieldPair[] = formModel.fields.map((f) => ({
          docIndex,
          fileName: file.name,
          refId: f.name,
          rawLabel: f.name,
          normalizedLabel: normalizeLabel(f.name),
          value: f.value.trim()
        }));

        return {
          doc: { fileName: file.name, kind: 'pdf-form', pdfFields: formModel.fields },
          fields
        };
      }

      // If it is not a form, try a normal selectable-text PDF.
      try {
        const textModel = await parsePdfText(file);

        if (!textModel) {
          throw new Error('Unable to parse selectable text from PDF.');
        }

        const fields: FieldPair[] = textModel.paragraphs
          .filter((p) => p.isLabelValue)
          .map((p) => ({
            docIndex,
            fileName: file.name,
            refId: String(p.index),
            rawLabel: p.label!,
            normalizedLabel: normalizeLabel(p.label!),
            value: (p.value || '').trim()
          }));

        return {
          doc: {
            fileName: file.name,
            kind: 'pdf-text',
            paragraphs: textModel.paragraphs
          },
          fields
        };
      } catch (textErr) {
        return {
          doc: {
            fileName: file.name,
            kind: 'unsupported',
            unsupportedReason:
              textErr instanceof Error
                ? textErr.message
                : 'PDF is not a supported fillable form or selectable-text document.'
          },
          fields: []
        };
      }
    } catch (err) {
      return {
        doc: {
          fileName: file.name,
          kind: 'unsupported',
          unsupportedReason:
            err instanceof Error ? err.message : 'Failed to parse .pdf'
        },
        fields: []
      };
    }
  }

  return {
    doc: { fileName: file.name, kind: 'unsupported', unsupportedReason: 'Unsupported file type. Upload .docx, .xlsx, or a fillable .pdf.' },
    fields: []
  };
}

import type { PdfFieldRef } from '../types';

export interface PdfFormModel {
  fields: PdfFieldRef[];
}

export async function parsePdfForm(file: File): Promise<PdfFormModel | null> {
  const { PDFDocument } = await import('pdf-lib');
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  if (fields.length === 0) {
    return null; // Not a fillable form — Phase 1 doesn't support flat/scanned PDFs.
  }

  const result: PdfFieldRef[] = [];
  fields.forEach((field) => {
    const name = field.getName();
    let value = '';
    try {
      // Only text fields have a meaningful string value we can round-trip;
      // checkboxes/radio/dropdowns are skipped for now (Phase 1 scope).
      const anyField = field as unknown as { getText?: () => string | undefined };
      if (typeof anyField.getText === 'function') {
        value = anyField.getText() || '';
      }
    } catch {
      // Field type doesn't support getText() — skip it.
      return;
    }
    result.push({ name, value });
  });

  return { fields: result };
}

export async function fillPdfForm(file: File, replacements: Map<string, string>): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  replacements.forEach((value, fieldName) => {
    try {
      const field = form.getTextField(fieldName);
      field.setText(value);
      const autoSizable = field as unknown as { enableAutoSize?: () => void };
      try {
        autoSizable.enableAutoSize?.();
      } catch {
        // Older pdf-lib versions or non-resizable fields — safe to ignore.
      }
    } catch {
      // Field not found or not a text field — skip it rather than fail
      // the whole batch.
    }
  });

  const outBytes = await pdfDoc.save();
  return new Blob([outBytes as unknown as BlobPart], { type: 'application/pdf' });
}

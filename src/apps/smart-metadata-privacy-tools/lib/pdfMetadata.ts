import { PDFDocument } from 'pdf-lib';
import type { CleanResult, MetadataGroup, MetadataField } from './types';

export interface PdfInspectionResult {
  groups: MetadataGroup[];
  pageCount: number;
  hasAnyMetadata: boolean;
  warnings: string[];
}

function field(key: string, label: string, value: string | undefined, sensitive = false, note?: string): MetadataField | null {
  if (!value) return null;
  return { key, label, value, sensitive, note };
}

export async function inspectPdfMetadata(file: File): Promise<PdfInspectionResult> {
  const warnings: string[] = [];
  const buffer = await file.arrayBuffer();

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(buffer, { updateMetadata: false });
  } catch {
    throw new Error('This PDF could not be parsed. It may be encrypted, corrupted, or use an unsupported structure.');
  }

  const fields: MetadataField[] = [];
  const push = (f: MetadataField | null) => {
    if (f) fields.push(f);
  };

  push(field('title', 'Title', doc.getTitle()));
  push(field('author', 'Author', doc.getAuthor(), true, 'May reveal the identity of whoever created the document.'));
  push(field('subject', 'Subject', doc.getSubject()));
  const keywords = doc.getKeywords();
  push(field('keywords', 'Keywords', keywords));
  push(field('creator', 'Creator Application', doc.getCreator(), true, 'Identifies the software used to create the file.'));
  push(field('producer', 'Producer', doc.getProducer(), true, 'Identifies the software used to export/produce the PDF.'));

  const created = doc.getCreationDate();
  push(field('creationDate', 'Creation Date', created ? created.toLocaleString() : undefined, true));
  const modified = doc.getModificationDate();
  push(field('modificationDate', 'Modification Date', modified ? modified.toLocaleString() : undefined, true));

  const groups: MetadataGroup[] = fields.length ? [{ title: 'Document Metadata', fields }] : [];
  if (!groups.length) warnings.push('No standard document metadata fields were found in this PDF.');
  warnings.push('This inspection covers standard document info fields only, not custom XMP metadata or embedded object properties.');

  return {
    groups,
    pageCount: doc.getPageCount(),
    hasAnyMetadata: fields.length > 0,
    warnings,
  };
}

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

/**
 * Produces a copy of the PDF with standard document-info metadata fields
 * cleared. Page content is preserved untouched. This does not rewrite or
 * guarantee removal of custom XMP metadata streams or other embedded
 * objects that some PDF producers add outside the standard info dictionary.
 */
export async function cleanPdfMetadata(file: File): Promise<CleanResult> {
  const buffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(buffer, { updateMetadata: false });

  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setCreator('');
  doc.setProducer('');
  const epoch = new Date(0);
  doc.setCreationDate(epoch);
  doc.setModificationDate(epoch);

  const bytes = await doc.save();
  // Cast avoids a strict-lib mismatch between Uint8Array<ArrayBufferLike> and
  // the BlobPart type in some TypeScript/lib configurations.
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const fileName = `${stripExtension(file.name)}-clean.pdf`;

  return {
    blob,
    fileName,
    originalFormat: 'application/pdf',
    outputFormat: 'application/pdf',
    originalSize: file.size,
    cleanedSize: blob.size,
    note:
      'Standard document metadata (title, author, subject, keywords, creator, producer, dates) was cleared. ' +
      'Page content was preserved unchanged. This does not guarantee removal of custom XMP metadata or every possible hidden object.',
  };
}

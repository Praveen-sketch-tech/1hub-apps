import type { ParagraphModel } from '../types';

export interface PdfTextModel {
  paragraphs: ParagraphModel[];
  text: string;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseLabelValue(text: string): { label: string; value: string } | null {
  const cleaned = cleanText(text);

  if (!cleaned) return null;

  const match = cleaned.match(/^([^:]{1,100}):\s*(.+)$/);
  if (!match) return null;

  const label = match[1].trim();
  const value = match[2].trim();

  if (!label || !value) return null;

  return { label, value };
}


export interface PdfTextField {
  label: string;
  value: string;
  confidence: number;
  source: 'colon' | 'equals' | 'same-line' | 'next-line' | 'placeholder';
}

export interface PdfTextModel {
  text: string;
  fields: PdfTextField[];
}

const COMMON_LABELS = new Set([
  'name',
  'full name',
  'applicant name',
  'employee name',
  'company',
  'company name',
  'name of company',
  'address',
  'mobile',
  'mobile number',
  'phone',
  'phone number',
  'email',
  'email id',
  'employee id',
  'designation',
  'department',
  'manager name',
  'manager',
  'contact details',
  'aadhar number',
  'aadhaar number',
  'pan',
  'pan number',
  'pan of employer',
  'employer name',
  'joining date',
  'date of joining',
  'salary',
  'salary per month',
  'monthly salary',
  'basic salary',
  'gross salary',
  'net salary',
  'reference number',
  'application date'
]);

function clean(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeLabel(label: string): string {
  return clean(label)
    .replace(/[:=]+$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isUsefulValue(value: string): boolean {
  const v = clean(value);
  if (!v) return false;
  if (/^[_\-. ]+$/.test(v)) return false;
  return true;
}

function isLikelyLabel(line: string): boolean {
  const normalized = normalizeLabel(line);
  if (!normalized || normalized.length > 80) return false;

  if (COMMON_LABELS.has(normalized)) return true;

  return /^(name|address|contact|mobile|phone|email|company|manager|employee|designation|department|salary|date|aadhar|aadhaar|pan|employer|reference|application)\b/i.test(normalized);
}

function addField(
  fields: PdfTextField[],
  label: string,
  value: string,
  source: PdfTextField['source'],
  confidence: number
) {
  const l = clean(label).replace(/[:=]+$/, '');
  const v = clean(value);

  if (!l || !isUsefulValue(v)) return;

  const normalized = normalizeLabel(l);
  if (!normalized) return;

  const duplicate = fields.find(
    (f) => normalizeLabel(f.label) === normalized && clean(f.value) === v
  );

  if (!duplicate) {
    fields.push({ label: l, value: v, source, confidence });
  }
}

export async function parsePdfText(file: File): Promise<PdfTextModel | null> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = new Uint8Array(await file.arrayBuffer());

  const loadingTask = pdfjs.getDocument({
    data: bytes
  });

  const pdf = await loadingTask.promise;
  const lines: string[] = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();

    // PDF.js returns text as positioned items rather than reliable
    // newline-separated strings. Reconstruct visual lines using the
    // Y coordinate, then sort each line left-to-right.
    const positioned: Array<{ text: string; x: number; y: number }> = [];

    for (const item of content.items) {
      if (!('str' in item)) continue;

      const text = clean(String(item.str || ''));
      if (!text) continue;

      const raw = item as unknown as {
        transform?: number[];
        width?: number;
      };

      const transform = raw.transform || [];
      const x = Number(transform[4] || 0);
      const y = Number(transform[5] || 0);

      positioned.push({ text, x, y });
    }

    // Group items whose baseline is visually on the same line.
    const lineGroups: Array<{
      y: number;
      items: Array<{ text: string; x: number }>;
    }> = [];

    const Y_TOLERANCE = 3;

    for (const item of positioned) {
      let group = lineGroups.find((g) => Math.abs(g.y - item.y) <= Y_TOLERANCE);

      if (!group) {
        group = { y: item.y, items: [] };
        lineGroups.push(group);
      }

      group.items.push({
        text: item.text,
        x: item.x
      });
    }

    // PDF coordinates normally run bottom-to-top, so reverse Y order
    // to reconstruct normal reading order.
    lineGroups.sort((a, b) => b.y - a.y);

    for (const group of lineGroups) {
      group.items.sort((a, b) => a.x - b.x);

      let line = '';

      for (const item of group.items) {
        if (!line) {
          line = item.text;
          continue;
        }

        // Preserve separation between independently positioned PDF text
        // fragments. This is important for "Label: Value" and underscores.
        line += ' ' + item.text;
      }

      const cleanedLine = clean(line);
      if (cleanedLine) lines.push(cleanedLine);
    }
  }

  const text = lines.join('\n');
  const fields: PdfTextField[] = [];

  // 1. Label: Value
  for (const line of lines) {
    const m = line.match(/^(.{1,80}?)\s*:\s*(.+)$/);
    if (m && isLikelyLabel(m[1])) {
      addField(fields, m[1], m[2], 'colon', 0.98);
    }
  }

  // 2. Label = Value
  for (const line of lines) {
    const m = line.match(/^(.{1,80}?)\s*=\s*(.+)$/);
    if (m && isLikelyLabel(m[1])) {
      addField(fields, m[1], m[2], 'equals', 0.96);
    }
  }

  // 3. Placeholder fields:
  //    Manager Name __________________
  //    SALARY PER MONTH = Rs. ______
  for (const line of lines) {
    const m = line.match(/^(.{1,80}?)(?:[_]{3,}|\.{3,})\s*$/);
    if (m && isLikelyLabel(m[1])) {
      continue;
    }

    const placeholder = line.match(/^(.{1,100}?)(?:[_]{3,}|\.{3,})(.*)$/);
    if (placeholder) {
      const label = clean(placeholder[1]);
      if (isLikelyLabel(label)) {
        // Don't create a reusable value from a blank placeholder.
        // The label is still recognized by downstream Fill logic.
        fields.push({
          label,
          value: '',
          source: 'placeholder',
          confidence: 0.85
        });
      }
    }
  }

  // 4. Label on one line, value on the next line.
  for (let i = 0; i < lines.length - 1; i++) {
    const label = lines[i];
    const value = lines[i + 1];

    if (!isLikelyLabel(label)) continue;
    if (!isUsefulValue(value)) continue;
    if (isLikelyLabel(value)) continue;

    addField(fields, label, value, 'next-line', 0.88);
  }

  // 5. Common labels embedded in a sentence.
  const sentencePatterns: Array<[RegExp, string]> = [
    [/Mr\.\s*\/\s*Mrs\.\s*\/\s*Miss\s+([A-Za-z][A-Za-z .'-]{2,})\s+S\/O/i, 'Name'],
    [/Mr\.\s+([A-Za-z][A-Za-z .'-]{2,})\s+S\/O/i, 'Name'],
    [/working with us since\s+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/i, 'Joining Date'],
    [/as an?\s+([A-Za-z][A-Za-z .'-]{2,})(?:\s+and|\s+and his\/her|\s*$)/i, 'Designation'],
    [/salary per month\s*=\s*(?:Rs\.?\s*)?([0-9][0-9,]*(?:\.[0-9]+)?)/i, 'Salary Per Month']
  ];

  for (const [pattern, label] of sentencePatterns) {
    const m = text.match(pattern);
    if (m?.[1]) {
      addField(fields, label, m[1], 'same-line', 0.72);
    }
  }

  // Remove blank placeholder values from normal Learn field output.
  // They remain detectable in the raw model but must never become
  // reusable profile values.
  const usableFields = fields.filter((f) => isUsefulValue(f.value));

  return {
    text,
    fields: usableFields,
    paragraphs: usableFields.map((f, index) => ({
      index,
      text: f.value ? `${f.label}: ${f.value}` : f.label,
      bold: false,
      align: 'left' as const,
      headingLevel: 0 as const,
      isLabelValue: true,
      label: f.label,
      value: f.value
    }))
  };
}

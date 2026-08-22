import type { ParagraphModel } from '../types';

export interface PdfTextField {
  label: string;
  value: string;
  confidence: number;
  source: 'colon' | 'equals' | 'same-line' | 'next-line' | 'placeholder';
}

export interface PdfTextModel {
  text: string;
  fields: PdfTextField[];
  paragraphs: ParagraphModel[];
}

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
  if (!normalized || normalized.length > 100) return;

  // Avoid obvious sentence/title fragments being treated as labels.
  if (/[.!?]$/.test(l) && l.split(/\s+/).length > 8) return;

  const duplicate = fields.find(
    (f) =>
      normalizeLabel(f.label) === normalized &&
      clean(f.value) === v
  );

  if (!duplicate) {
    fields.push({
      label: l,
      value: v,
      source,
      confidence
    });
  }
}

/**
 * Generic label heuristic.
 *
 * We deliberately do NOT maintain a hard-coded list of document labels.
 * A label is inferred from structure, punctuation and typography instead.
 */
function looksLikeLabel(value: string): boolean {
  const s = clean(value);

  if (!s || s.length > 100) return false;
  if (/^[0-9]+$/.test(s)) return false;
  if (/^[,.\-_/]+$/.test(s)) return false;

  // Sentences are unlikely to be labels.
  if (s.split(/\s+/).length > 12) return false;
  if (/[.!?]$/.test(s)) return false;

  // A label normally starts with a word/letter.
  if (!/^[A-Za-z][A-Za-z0-9 &'()./#-]*$/.test(s)) return false;

  return true;
}

/**
 * Detect a same-line "label value" structure without requiring
 * a colon or equals sign.
 *
 * Examples:
 *   Name Amit Kumar
 *   Manager Name Suresh Sharma
 *   Address 45 Nehru Nagar
 *
 * The parser uses word-boundary candidates and value characteristics,
 * rather than a document-specific label dictionary.
 */
function looksLikeValue(value: string): boolean {
  const s = clean(value);

  if (!s || s.length < 2) return false;

  // Strong value signals.
  if (/\d/.test(s)) return true;
  if (/@/.test(s)) return true;
  if (/[₹$€£]/.test(s)) return true;

  // Dates / phone-like values / IDs.
  if (/\b\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}\b/.test(s)) return true;
  if (/\b[A-Z0-9]{4,}[-/][A-Z0-9-]+\b/i.test(s)) return true;

  // Names / companies / addresses generally contain multiple words
  // with normal title-case or mixed-case tokens.
  const words = s.split(/\s+/);

  if (words.length >= 2) {
    const titleCaseWords = words.filter((w) =>
      /^[A-Z][A-Za-z'().-]*$/.test(w)
    ).length;

    if (titleCaseWords >= 1) return true;
  }

  return false;
}

function looksLikeSentence(value: string): boolean {
  const s = clean(value);

  if (!s) return true;

  if (/[.!?]$/.test(s)) return true;

  const words = s.split(/\s+/);

  if (words.length > 12) return true;

  // Common prose indicators. These are linguistic signals,
  // not document-specific field names.
  return /\b(this|that|these|those|the|and|or|with|from|for|to|is|are|was|were|hereby|above|below|given|mentioned|working|issued)\b/i.test(s)
    && words.length >= 5;
}

/** A visually-separated block of text on one line (one "column"). */
interface RowSegment {
  text: string;
  x: number;
  width: number;
}

/** One horizontal line, already split into column segments. */
interface Row {
  y: number;
  segments: RowSegment[];
}

/**
 * Strong, unambiguous evidence that text is a *value* rather than a
 * label/heading — digits, currency, email, etc. Deliberately stricter
 * than looksLikeValue(), which also treats plain multi-word Title Case
 * phrases (including things like "Name of Company") as value-like and
 * is therefore too loose to use when telling a header row apart from
 * a data row.
 */
function hasStrongValueSignal(value: string): boolean {
  const s = clean(value);
  if (!s) return false;
  if (/\d/.test(s)) return true;
  if (/@/.test(s)) return true;
  if (/[₹$€£]/.test(s)) return true;
  if (/\b(?:Rs|INR)\b/i.test(s)) return true;
  return false;
}

/**
 * Merge same-line text items into visually separated column segments,
 * using real PDF item widths/positions — a horizontal gap of GAP_THRESHOLD
 * or more between two items means they belong to different columns of a
 * form/table row, not the same run of text.
 */
function buildSegments(
  items: Array<{ text: string; x: number; width: number }>,
  gapThreshold = 18
): RowSegment[] {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const segments: RowSegment[] = [];

  for (const item of sorted) {
    const last = segments[segments.length - 1];

    if (last) {
      const gap = item.x - (last.x + last.width);

      if (gap < gapThreshold) {
        last.text = clean(`${last.text} ${item.text}`);
        last.width = item.x + item.width - last.x;
        continue;
      }
    }

    segments.push({ text: clean(item.text), x: item.x, width: item.width });
  }

  return segments.filter((s) => s.text.length > 0);
}

/**
 * Detect a 2-row column-aligned table header:
 *
 *   Name of Company        Company Seal and Signature
 *   Shree Balaji Enterprises   Authorized Signatory
 *
 * The row above is pure header text (no digits/currency/email in any
 * column); the row below supplies the actual values, column-aligned
 * with the header above it. Each aligned column becomes its own field,
 * instead of (wrongly) treating the two headers on the same row as a
 * label/value pair.
 */
function detectTableFields(rows: Row[]): {
  fields: Array<{ label: string; value: string; confidence: number }>;
  consumed: Set<number>;
} {
  const fields: Array<{
    label: string;
    value: string;
    confidence: number;
  }> = [];
  const consumed = new Set<number>();

  const X_TOLERANCE = 25;
  const MAX_ROW_GAP_Y = 50;

  for (let i = 0; i < rows.length - 1; i++) {
    if (consumed.has(i) || consumed.has(i + 1)) continue;

    const headerRow = rows[i];
    const valueRow = rows[i + 1];

    if (headerRow.segments.length < 2) continue;
    if (headerRow.segments.length !== valueRow.segments.length) continue;
    if (headerRow.y - valueRow.y > MAX_ROW_GAP_Y) continue;

    const headerIsPureText = headerRow.segments.every(
      (seg) =>
        looksLikeLabel(seg.text) &&
        !looksLikeSentence(seg.text) &&
        !hasStrongValueSignal(seg.text)
    );
    if (!headerIsPureText) continue;

    const valueRowLooksUseful = valueRow.segments.every(
      (seg) => isUsefulValue(seg.text) && !looksLikeSentence(seg.text)
    );
    if (!valueRowLooksUseful) continue;

    const columnsAlign = headerRow.segments.every(
      (seg, idx) => Math.abs(seg.x - valueRow.segments[idx].x) <= X_TOLERANCE
    );
    if (!columnsAlign) continue;

    for (let c = 0; c < headerRow.segments.length; c++) {
      const label = headerRow.segments[c].text;
      const value = valueRow.segments[c].text;

      if (!label || !isUsefulValue(value)) continue;

      fields.push({ label, value, confidence: 0.82 });
    }

    consumed.add(i);
    consumed.add(i + 1);
  }

  return { fields, consumed };
}

/**
 * Detect same-row label/value pairs using real column segments
 * (a genuine horizontal gap between columns, not guessed word
 * boundaries). Handles one or more label/value pairs on a single
 * row:
 *
 *   Manager Name        Suresh Sharma
 *   Address              45 Nehru Nagar, Ratlam, Madhya Pradesh 457001
 *
 * Rows already consumed by detectTableFields() are skipped so a
 * header row is never double-counted as a same-row pair.
 */
function detectRowPairFields(
  rows: Row[],
  consumed: Set<number>
): Array<{ label: string; value: string; confidence: number }> {
  const results: Array<{
    label: string;
    value: string;
    confidence: number;
  }> = [];

  rows.forEach((row, rowIndex) => {
    if (consumed.has(rowIndex)) return;
    if (row.segments.length < 2) return;

    // Pair sequentially: (label, value), (label, value), ...
    const pairCount = Math.floor(row.segments.length / 2);

    for (let p = 0; p < pairCount; p++) {
      const labelSeg = row.segments[p * 2];
      const valueSeg = row.segments[p * 2 + 1];

      const label = labelSeg.text;
      const value = valueSeg.text;

      if (!label || !isUsefulValue(value)) continue;
      if (!looksLikeLabel(label) || looksLikeSentence(label)) continue;
      if (looksLikeSentence(value)) continue;

      let score = 0.75;
      if (hasStrongValueSignal(value)) score += 0.1;
      if (label.split(/\s+/).length <= 5) score += 0.04;

      results.push({ label, value, confidence: Math.min(score, 0.9) });
    }
  });

  return results;
}

/**
 * Detect "label on one line, value on the next line" — a very common
 * real-world form layout:
 *
 *   Manager Name
 *   Suresh Sharma
 *
 *   Address
 *   45 Nehru Nagar, Ratlam, Madhya Pradesh 457001
 *
 * Only single-column rows (exactly one visual segment) are eligible to
 * act as a label or a value here — a row that already contains multiple
 * columns (handled by detectTableFields / detectRowPairFields) is a
 * compound line, not an atomic label or value, and pairing it whole
 * against a neighboring line produces nonsense. Skipping it also
 * prevents it from being chained into an unrelated pair.
 *
 * To avoid misreading two consecutive real labels as a label/value pair
 * (e.g. "Manager Name" followed by the next field's label), each line is
 * consumed at most once: once a line is used as a value, the scan jumps
 * past it instead of re-considering it as a label for the following line.
 */
function detectNextLineFields(
  pageLines: Array<{ text: string; x: number; segmentCount: number }>
): Array<{ label: string; value: string; confidence: number }> {
  const results: Array<{
    label: string;
    value: string;
    confidence: number;
  }> = [];

  const X_TOLERANCE = 40;

  let i = 0;
  while (i < pageLines.length - 1) {
    const cur = pageLines[i];
    const nxt = pageLines[i + 1];

    if (cur.segmentCount !== 1) {
      i += 1;
      continue;
    }

    const label = clean(cur.text);
    const value = clean(nxt.text);

    // Already handled by the colon/equals passes.
    if (/[:=]/.test(label)) {
      i += 1;
      continue;
    }

    // All-caps multi-word lines read as document headings/titles
    // ("CASH SALARY CERTIFICATE"), not field labels — skip using this
    // line as a label, but leave it free to be re-evaluated as part of
    // the next pair.
    const isHeading =
      label === label.toUpperCase() &&
      label !== label.toLowerCase() &&
      label.split(/\s+/).length > 1;

    if (
      !isHeading &&
      nxt.segmentCount === 1 &&
      looksLikeLabel(label) &&
      !looksLikeSentence(label) &&
      label.split(/\s+/).length <= 6 &&
      looksLikeValue(value) &&
      !looksLikeSentence(value) &&
      Math.abs(cur.x - nxt.x) <= X_TOLERANCE
    ) {
      results.push({ label, value, confidence: 0.72 });
      i += 2; // Both lines consumed — don't let the value double as a label.
      continue;
    }

    i += 1;
  }

  return results;
}

export async function parsePdfText(
  file: File
): Promise<PdfTextModel | null> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Browser/Vite: use the bundled PDF.js worker.
  // Node/Kali tests: leave workerSrc unset so PDF.js uses its fake-worker
  // fallback without trying to resolve a browser asset path.
  if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      '/pdf.worker.min.mjs',
      window.location.origin
    ).toString();
  }

  const loadingTask = pdfjs.getDocument({
    data: bytes
  });

  const pdf = await loadingTask.promise;
  const lines: string[] = [];

  // Label-next-line candidates, kept per-page (reading order) since
  // pairing must never cross a page boundary.
  const nextLineCandidates: Array<{
    label: string;
    value: string;
    confidence: number;
  }> = [];

  // Column-aligned table headers and same-row multi-column pairs, both
  // resolved per-page using real PDF x/width data — see detectTableFields
  // and detectRowPairFields.
  const tableFieldCandidates: Array<{
    label: string;
    value: string;
    confidence: number;
  }> = [];
  const rowPairCandidates: Array<{
    label: string;
    value: string;
    confidence: number;
  }> = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();

    const positioned: Array<{
      text: string;
      x: number;
      y: number;
      width: number;
    }> = [];

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
      const width = Number(raw.width || text.length * 5);

      positioned.push({
        text,
        x,
        y,
        width
      });
    }

    const lineGroups: Array<{
      y: number;
      items: Array<{
        text: string;
        x: number;
        width: number;
      }>;
    }> = [];

    const Y_TOLERANCE = 3;

    for (const item of positioned) {
      let group = lineGroups.find(
        (g) => Math.abs(g.y - item.y) <= Y_TOLERANCE
      );

      if (!group) {
        group = {
          y: item.y,
          items: []
        };

        lineGroups.push(group);
      }

      group.items.push({
        text: item.text,
        x: item.x,
        width: item.width
      });
    }

    lineGroups.sort((a, b) => b.y - a.y);

    // Build rows (with column segments already split by real x/width
    // gaps) for this page — used by the table and row-pair detectors.
    const rows: Row[] = lineGroups.map((group) => ({
      y: group.y,
      segments: buildSegments(group.items)
    }));

    const pageLines: Array<{
      text: string;
      x: number;
      segmentCount: number;
    }> = [];

    for (const row of rows) {
      const cleanedLine = clean(
        row.segments.map((s) => s.text).join(' ')
      );

      if (cleanedLine) {
        lines.push(cleanedLine);
        pageLines.push({
          text: cleanedLine,
          x: row.segments[0]?.x ?? 0,
          segmentCount: row.segments.length
        });
      }
    }

    nextLineCandidates.push(...detectNextLineFields(pageLines));

    const { fields: tableFields, consumed } = detectTableFields(rows);
    tableFieldCandidates.push(...tableFields);
    rowPairCandidates.push(...detectRowPairFields(rows, consumed));
  }

  const text = lines.join('\n');
  const fields: PdfTextField[] = [];

  // ------------------------------------------------------------
  // 1. Explicit Label: Value
  // ------------------------------------------------------------
  for (const line of lines) {
    const m = line.match(/^(.{1,100}?)\s*:\s*(.+)$/);

    if (!m) continue;

    const label = clean(m[1]);
    const value = clean(m[2]);

    if (looksLikeLabel(label) && isUsefulValue(value)) {
      addField(fields, label, value, 'colon', 0.98);
    }
  }

  // ------------------------------------------------------------
  // 2. Explicit Label = Value
  // ------------------------------------------------------------
  for (const line of lines) {
    const m = line.match(/^(.{1,100}?)\s*=\s*(.+)$/);

    if (!m) continue;

    const label = clean(m[1]);
    const value = clean(m[2]);

    if (looksLikeLabel(label) && isUsefulValue(value)) {
      addField(fields, label, value, 'equals', 0.96);
    }
  }

  // ------------------------------------------------------------
  // 3. Blank placeholders
  // ------------------------------------------------------------
  for (const line of lines) {
    const placeholder = line.match(
      /^(.{1,100}?)(?:_{3,}|\.{3,})\s*(.*)$/
    );

    if (!placeholder) continue;

    const label = clean(placeholder[1]);

    if (!looksLikeLabel(label)) continue;

    const value = clean(placeholder[2]);

    if (isUsefulValue(value)) {
      addField(
        fields,
        label,
        value,
        'placeholder',
        0.85
      );
    }
  }

  // ------------------------------------------------------------
  // 4. Label on one line, value on next line.
  // ------------------------------------------------------------
  // Uses the original PDF x/y coordinates (via nextLineCandidates,
  // built per-page above) rather than guessing from reconstructed
  // text alone — see detectNextLineFields() for the layout rules
  // and false-positive guards (heading exclusion, single-use lines,
  // left-alignment check).
  for (const candidate of nextLineCandidates) {
    addField(
      fields,
      candidate.label,
      candidate.value,
      'next-line',
      candidate.confidence
    );
  }

  // ------------------------------------------------------------
  // 5. Column-aligned table headers (2-row: header row + value row)
  // ------------------------------------------------------------
  // e.g. "Name of Company | Company Seal and Signature" followed by
  // "Shree Balaji Enterprises | Authorized Signatory" — see
  // detectTableFields() for the alignment/heuristic rules.
  for (const field of tableFieldCandidates) {
    addField(fields, field.label, field.value, 'same-line', field.confidence);
  }

  // ------------------------------------------------------------
  // Same-row label/value pairs (real column-gap based, no guessed
  // word boundaries) — see detectRowPairFields().
  // ------------------------------------------------------------
  for (const field of rowPairCandidates) {
    addField(fields, field.label, field.value, 'same-line', field.confidence);
  }

  // ------------------------------------------------------------
  // 6. Keep only usable fields
  // ------------------------------------------------------------
  const usableFields = fields.filter((field) =>
    isUsefulValue(field.value)
  );

  const paragraphs: ParagraphModel[] = usableFields.map(
    (field, index) => ({
      index,
      text: `${field.label}: ${field.value}`,
      bold: false,
      align: 'left' as const,
      headingLevel: 0 as const,
      isLabelValue: true,
      label: field.label,
      value: field.value
    })
  );

  return {
    text,
    fields: usableFields,
    paragraphs
  };
}

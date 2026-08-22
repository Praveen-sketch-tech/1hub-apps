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

function detectSameLineField(line: string): {
  label: string;
  value: string;
} | null {
  const s = clean(line);

  if (!s || s.length < 4) return null;

  /*
   * Do NOT guess arbitrary word boundaries.
   *
   * A PDF line such as:
   *
   *   Address 45 Nehru Nagar, Ratlam...
   *
   * contains no reliable delimiter in the extracted text.
   * Splitting it by words creates false fields and can corrupt
   * long values.
   *
   * Explicit ":" and "=" fields are handled separately by the
   * parser. Separator-less fields will be handled using PDF
   * positioning information rather than guessing.
   */
  return null;
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
 * This only runs on lines that share (roughly) the same left x position,
 * which is what a genuine single-column label/value form looks like —
 * it is NOT a guess based on any specific label vocabulary.
 *
 * To avoid misreading two consecutive real labels as a label/value pair
 * (e.g. "Manager Name" followed by the next field's label), each line is
 * consumed at most once: once a line is used as a value, the scan jumps
 * past it instead of re-considering it as a label for the following line.
 */
function detectNextLineFields(
  pageLines: Array<{ text: string; x: number }>
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

function detectPositionalFields(
  items: Array<{ text: string; x: number; y: number }>
): Array<{ label: string; value: string; confidence: number }> {
  const results: Array<{
    label: string;
    value: string;
    confidence: number;
  }> = [];

  if (items.length < 2) return results;

  // Group text items by visual baseline.
  const groups: Array<{
    y: number;
    items: Array<{ text: string; x: number; width: number }>;
  }> = [];

  for (const item of items) {
    const existing = groups.find(
      (g) => Math.abs(g.y - item.y) <= 3
    );

    if (!existing) {
      groups.push({
        y: item.y,
        items: [{
          text: item.text,
          x: item.x,
          width: Math.max(item.text.length * 5, 1)
        }]
      });
    } else {
      existing.items.push({
        text: item.text,
        x: item.x,
        width: Math.max(item.text.length * 5, 1)
      });
    }
  }

  for (const group of groups) {
    group.items.sort((a, b) => a.x - b.x);

    if (group.items.length < 2) continue;

    /*
     * Look for a genuine horizontal column gap.
     *
     * We do not assume field names. We only use layout:
     *
     *   [text block]        [text block]
     *
     * A large gap between two blocks is stronger evidence than
     * guessing that the first word is a label.
     */
    for (let i = 0; i < group.items.length - 1; i++) {
      const left = group.items[i];
      const right = group.items[i + 1];

      const leftEnd = left.x + left.width;
      const gap = right.x - leftEnd;

      if (gap < 18) continue;

      const label = clean(left.text);
      const value = clean(
        group.items
          .slice(i + 1)
          .map((item) => item.text)
          .join(' ')
      );

      if (!label || !value) continue;
      if (label.length > 100) continue;
      if (!isUsefulValue(value)) continue;

      /*
       * Avoid obvious prose/headings.
       */
      if (looksLikeSentence(label)) continue;

      /*
       * Values containing numbers, email-like strings, dates,
       * identifiers, currency, or longer multi-word content are
       * stronger candidates. Pure short prose is intentionally
       * lower confidence.
       */
      let score = 0.70;

      if (/\d/.test(value)) score += 0.08;
      if (/@/.test(value)) score += 0.08;
      if (/\b(?:Rs|INR)\b/i.test(value)) score += 0.05;
      if (value.length >= 8) score += 0.04;

      /*
       * A left block should look structurally label-like without
       * requiring a hardcoded list of document-specific fields.
       */
      const labelWords = label.split(/\s+/);

      if (labelWords.length <= 5) score += 0.04;
      if (/^[A-Za-z][A-Za-z0-9 &'().\/-]*$/.test(label)) {
        score += 0.03;
      }

      if (score >= 0.78) {
        results.push({
          label,
          value,
          confidence: Math.min(score, 0.90)
        });
      }

      break;
    }
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

  const allPositionedItems: Array<{
    text: string;
    x: number;
    y: number;
  }> = [];

  // Left-aligned line records, kept per-page (reading order), used for
  // label-next-line detection. Kept separate from `lines` because pairing
  // must never cross a page boundary.
  const nextLineCandidates: Array<{
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
    }> = [];

    for (const item of content.items) {
      if (!('str' in item)) continue;

      const text = clean(String(item.str || ''));
      if (!text) continue;

      const raw = item as unknown as {
        transform?: number[];
      };

      const transform = raw.transform || [];

      const x = Number(transform[4] || 0);
      const y = Number(transform[5] || 0);

      positioned.push({
        text,
        x,
        y
      });

      allPositionedItems.push({
        text,
        x,
        y
      });
    }

    const lineGroups: Array<{
      y: number;
      items: Array<{
        text: string;
        x: number;
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
        x: item.x
      });
    }

    lineGroups.sort((a, b) => b.y - a.y);

    const pageLines: Array<{ text: string; x: number }> = [];

    for (const group of lineGroups) {
      group.items.sort((a, b) => a.x - b.x);

      const line = group.items
        .map((item) => item.text)
        .join(' ');

      const cleanedLine = clean(line);

      if (cleanedLine) {
        lines.push(cleanedLine);
        pageLines.push({ text: cleanedLine, x: group.items[0].x });
      }
    }

    nextLineCandidates.push(...detectNextLineFields(pageLines));
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
  // 5. Separator-less same-line fields
  // ------------------------------------------------------------
  // Intentionally disabled here. Arbitrary word splitting is unsafe.
  // Future detection must use PDF x/y positioning rather than guessing.

  // ------------------------------------------------------------
  // Positional Label / Value detection
  // ------------------------------------------------------------
  //
  // This is intentionally layout-driven. No document-specific field
  // names are required. PDF text coordinates are used to identify
  // separated label/value columns.
  //
  const positionalFields = detectPositionalFields(allPositionedItems);

  for (const field of positionalFields) {
    addField(
      fields,
      field.label,
      field.value,
      'same-line',
      field.confidence
    );
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

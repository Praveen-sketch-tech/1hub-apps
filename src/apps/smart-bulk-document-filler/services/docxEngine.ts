import type { ParagraphModel } from '../types';
import {
  clean,
  isUsefulValue,
  looksLikeLabel,
  looksLikeValue,
  looksLikeSentence
} from './fieldHeuristics';

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function encodeXmlEntities(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface RunSpan {
  rawXml: string;
  rPrXml: string;
  text: string;
  start: number; // char offset in the paragraph's concatenated text
  end: number;
}

function extractParagraphBlocks(documentXml: string): string[] {
  const matches = documentXml.match(/<w:p[ >][\s\S]*?<\/w:p>/g);
  return matches || [];
}

function extractRuns(paragraphXml: string): RunSpan[] {
  const runMatches = paragraphXml.match(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g) || [];
  const runs: RunSpan[] = [];
  let cursor = 0;

  runMatches.forEach((rawXml) => {
    const rPrMatch = rawXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
    const rPrXml = rPrMatch ? rPrMatch[0] : '';
    const textMatches = rawXml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
    const text = decodeXmlEntities(
      textMatches.map((t) => t.replace(/<w:t(?:\s[^>]*)?>/, '').replace(/<\/w:t>/, '')).join('')
    );
    runs.push({ rawXml, rPrXml, text, start: cursor, end: cursor + text.length });
    cursor += text.length;
  });

  return runs;
}

function paragraphPlainText(paragraphXml: string): string {
  return extractRuns(paragraphXml)
    .map((r) => r.text)
    .join('');
}

function detectAlignment(paragraphXml: string): ParagraphModel['align'] {
  const match = paragraphXml.match(/<w:jc\s+w:val="(\w+)"/);
  if (!match) return 'left';
  const val = match[1];
  if (val === 'center') return 'center';
  if (val === 'right' || val === 'end') return 'right';
  if (val === 'both') return 'justify';
  return 'left';
}

function detectHeadingLevel(paragraphXml: string): 0 | 1 | 2 | 3 {
  const match = paragraphXml.match(/<w:pStyle\s+w:val="Heading(\d)"/);
  if (!match) return 0;
  const level = parseInt(match[1], 10);
  return level >= 1 && level <= 3 ? (level as 1 | 2 | 3) : 0;
}

function detectUnderline(paragraphXml: string): boolean {
  return /<w:u\s+w:val="(?!none)[^"]*"/.test(paragraphXml);
}

function detectBold(paragraphXml: string): boolean {
  return /<w:rPr>[\s\S]*?<w:b\/?>|<w:b\s+w:val="(1|true)"/.test(paragraphXml);
}

const LABEL_VALUE_PATTERN = /^([^:：]{1,60})[:：]\s*(.*)$/;

interface OffsetSpan {
  start: number;
  end: number;
}

/**
 * Locate every <w:tr> row and, within it, every <w:tc> cell, as absolute
 * offset ranges in documentXml — used to work out which table row/cell
 * each paragraph (found separately, via the flat paragraph regex used
 * everywhere else in this file) physically sits inside.
 */
function findTableRows(documentXml: string): Array<{ row: OffsetSpan; cells: OffsetSpan[] }> {
  const rows: Array<{ row: OffsetSpan; cells: OffsetSpan[] }> = [];
  const rowRegex = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(documentXml))) {
    const rowXml = rowMatch[0];
    const rowStart = rowMatch.index;
    const cells: OffsetSpan[] = [];

    const cellRegex = /<w:tc[ >][\s\S]*?<\/w:tc>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowXml))) {
      cells.push({
        start: rowStart + cellMatch.index,
        end: rowStart + cellMatch.index + cellMatch[0].length
      });
    }

    rows.push({ row: { start: rowStart, end: rowStart + rowXml.length }, cells });
  }

  return rows;
}

/**
 * Detect label/value pairs from real Word table rows.
 *
 * A table cell is structurally already a distinct field slot — unlike
 * plain paragraph-to-paragraph adjacency, we don't need to lean on
 * looksLikeValue() to decide whether the second cell is "value enough"
 * (that heuristic is deliberately conservative and misses short single
 * words like "Engineering" or "Sales", which are completely ordinary
 * table-cell values). We only need the FIRST cell to look like a label;
 * whatever is in the following cell(s) is trusted as the value(s).
 */
function detectTableRowFields(
  documentXml: string,
  paragraphOffsets: OffsetSpan[],
  paragraphTexts: string[]
): {
  results: Array<{ labelIndex: number; valueIndex: number; label: string; value: string }>;
  consumed: Set<number>;
} {
  const results: Array<{
    labelIndex: number;
    valueIndex: number;
    label: string;
    value: string;
  }> = [];
  const consumed = new Set<number>();

  const rows = findTableRows(documentXml);

  for (const { cells } of rows) {
    if (cells.length < 2) continue;

    // For each cell, gather the paragraph indices whose offset falls
    // inside that cell's span (in document order), and join their text.
    const cellParagraphIndices: number[][] = cells.map((cell) =>
      paragraphOffsets
        .map((span, idx) => ({ span, idx }))
        .filter(({ span }) => span.start >= cell.start && span.end <= cell.end)
        .map(({ idx }) => idx)
    );

    const cellTexts = cellParagraphIndices.map((indices) =>
      clean(indices.map((i) => paragraphTexts[i]).join(' '))
    );

    const pairCount = Math.floor(cells.length / 2);

    for (let p = 0; p < pairCount; p++) {
      const labelIndices = cellParagraphIndices[p * 2];
      const valueIndices = cellParagraphIndices[p * 2 + 1];
      const label = cellTexts[p * 2];
      const value = cellTexts[p * 2 + 1];

      if (!labelIndices.length || !valueIndices.length) continue;
      if (!label || !isUsefulValue(value)) continue;
      if (!looksLikeLabel(label) || looksLikeSentence(label)) continue;
      if (looksLikeSentence(value)) continue;

      const labelIndex = labelIndices[0];
      const valueIndex = valueIndices[0];

      results.push({ labelIndex, valueIndex, label, value });
      labelIndices.forEach((i) => consumed.add(i));
      valueIndices.forEach((i) => consumed.add(i));
    }
  }

  return { results, consumed };
}

/**
 * Detect "label paragraph, then value paragraph" — this is the same
 * layout as the PDF engine's next-line detection, and it naturally
 * covers TWO very common real-world DOCX cases at once:
 *
 *  1. A genuine Word table row (a table cell is itself just one or more
 *     <w:p> paragraphs, and regex-based paragraph extraction already
 *     walks into table cells in document order, so "Manager Name" and
 *     "Suresh Sharma" show up as two consecutive paragraph entries even
 *     though they're really two cells of one row).
 *  2. A plain label on its own line, with the value typed on the very
 *     next line (no table involved at all).
 *
 * Each paragraph is consumed at most once (as a label or as a value) to
 * avoid mis-chaining a real label into the previous pair's value slot —
 * same guard as the PDF engine.
 */
function detectAdjacentParagraphFields(
  entries: Array<{
    index: number;
    text: string;
    headingLevel: 0 | 1 | 2 | 3;
    isLabelValue: boolean;
    emphasized: boolean;
  }>
): Array<{ labelIndex: number; valueIndex: number; label: string; value: string }> {
  const results: Array<{
    labelIndex: number;
    valueIndex: number;
    label: string;
    value: string;
  }> = [];

  // Only non-empty, not-already-a-field paragraphs can participate —
  // blank spacer paragraphs (common in Word for visual gaps) are skipped
  // over rather than treated as a hard break, so "Label" / "" / "Value"
  // still pairs correctly.
  const candidates = entries.filter((e) => clean(e.text).length > 0 && !e.isLabelValue);

  let i = 0;
  while (i < candidates.length - 1) {
    const cur = candidates[i];
    const nxt = candidates[i + 1];

    const label = clean(cur.text);
    const value = clean(nxt.text);

    const isHeading =
      cur.headingLevel > 0 ||
      (label === label.toUpperCase() &&
        label !== label.toLowerCase() &&
        label.split(/\s+/).length > 1);

    // A blank/unfilled template commonly styles every label the same way
    // (bold, underlined) and has nothing typed after them yet — so two
    // consecutive paragraphs sharing that same emphasis almost certainly
    // means "label, then the next label", not "label, then its value".
    // A real value is normally typed in plain, unstyled text right after
    // a styled label.
    const bothEmphasizedSame = cur.emphasized && nxt.emphasized;

    if (
      !isHeading &&
      !bothEmphasizedSame &&
      looksLikeLabel(label) &&
      !looksLikeSentence(label) &&
      label.split(/\s+/).length <= 6 &&
      looksLikeValue(value) &&
      !looksLikeSentence(value) &&
      isUsefulValue(value)
    ) {
      results.push({ labelIndex: cur.index, valueIndex: nxt.index, label, value });
      i += 2; // both consumed
      continue;
    }

    i += 1;
  }

  return results;
}

export interface DocxModel {
  documentXml: string;
  paragraphBlocks: string[];
  paragraphs: ParagraphModel[];
}

export async function parseDocx(file: File): Promise<DocxModel> {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error('This does not look like a valid .docx file (word/document.xml missing).');

  const documentXml = await docXmlFile.async('string');
  const paragraphBlocks = extractParagraphBlocks(documentXml);

  const paragraphs: ParagraphModel[] = paragraphBlocks.map((block, index) => {
    const text = paragraphPlainText(block).trim();
    const match = text.match(LABEL_VALUE_PATTERN);
    return {
      index,
      text,
      bold: detectBold(block),
      align: detectAlignment(block),
      headingLevel: detectHeadingLevel(block),
      isLabelValue: !!match && match[1].trim().length > 0,
      label: match ? match[1].trim() : undefined,
      value: match ? match[2].trim() : undefined
    };
  });

  // Paragraph offsets in documentXml, in the same order as paragraphBlocks
  // — used to work out which table row/cell each paragraph belongs to.
  const paragraphOffsets: OffsetSpan[] = [];
  {
    const offsetRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;
    let m: RegExpExecArray | null;
    while ((m = offsetRegex.exec(documentXml))) {
      paragraphOffsets.push({ start: m.index, end: m.index + m[0].length });
    }
  }

  // First pass: real Word table rows — structural, so it doesn't need to
  // second-guess whether a short single-word cell "looks like a value".
  const { results: tableFields, consumed: tableConsumed } = detectTableRowFields(
    documentXml,
    paragraphOffsets,
    paragraphs.map((p) => p.text)
  );

  tableFields.forEach(({ valueIndex, label, value }) => {
    const target = paragraphs[valueIndex];
    if (!target || target.isLabelValue) return;
    target.isLabelValue = true;
    target.label = label;
    target.value = value;
  });

  // Second pass: label/value pairs that span two paragraphs OUTSIDE a
  // table (a label with the value on the next line) — see
  // detectAdjacentParagraphFields() above. Anything already resolved by
  // the table pass is excluded so it can't be re-paired incorrectly.
  const adjacentFields = detectAdjacentParagraphFields(
    paragraphs
      .map((p) => ({
        index: p.index,
        text: p.text,
        headingLevel: p.headingLevel,
        isLabelValue: p.isLabelValue,
        emphasized: p.bold || detectUnderline(paragraphBlocks[p.index])
      }))
      .filter((p) => !tableConsumed.has(p.index))
  );

  adjacentFields.forEach(({ valueIndex, label, value }) => {
    const target = paragraphs[valueIndex];
    if (!target || target.isLabelValue) return;
    target.isLabelValue = true;
    target.label = label;
    target.value = value;
  });

  // Third pass: labels with no value at all — a blank/unfilled template
  // (e.g. someone's original .docx form before it's ever been filled in).
  // These still need to show up as fields, just with an empty value, so
  // the "Fill & Generate" step has something to pre-fill from a saved
  // profile or let the person type into. Only emphasized (bold/underline)
  // short label-shaped lines qualify — that formatting is what told us,
  // above, NOT to pair this line with its neighbor as a value; the same
  // signal is what makes it safe to treat as a genuine standalone label
  // here instead of stray text.
  paragraphs.forEach((p, index) => {
    if (p.isLabelValue) return;
    if (tableConsumed.has(index)) return;

    const text = clean(p.text);
    if (!text) return;

    const emphasized = p.bold || detectUnderline(paragraphBlocks[index]);
    if (!emphasized) return;

    const isHeading =
      p.headingLevel > 0 ||
      (text === text.toUpperCase() && text !== text.toLowerCase() && text.split(/\s+/).length > 1);
    if (isHeading) return;

    if (!looksLikeLabel(text) || looksLikeSentence(text)) return;
    if (text.split(/\s+/).length > 6) return;

    p.isLabelValue = true;
    p.label = text;
    p.value = '';
  });

  return { documentXml, paragraphBlocks, paragraphs };
}

/**
 * Replaces the value portion of specific label:value paragraphs in-place,
 * keeping every other byte of the document (fonts, headers, images, page
 * setup, unrelated paragraphs) completely untouched. Word's own text
 * layout naturally wraps longer values across more lines — there is no
 * fixed-size box to overflow, so this is inherently safe for values of any
 * length.
 */
export async function fillDocx(file: File, replacements: Map<number, string>): Promise<Blob> {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error('This does not look like a valid .docx file.');

  const documentXml = await docXmlFile.async('string');
  const paragraphBlocks = extractParagraphBlocks(documentXml);

  let updatedXml = documentXml;

  paragraphBlocks.forEach((block, index) => {
    const newValue = replacements.get(index);
    if (newValue === undefined) return;

    const runs = extractRuns(block);
    const fullText = runs.map((r) => r.text).join('');
    const match = fullText.match(LABEL_VALUE_PATTERN);

    if (!match) {
      const emphasized = detectBold(block) || detectUnderline(block);

      if (emphasized) {
        // Bold/underlined with no colon — this paragraph IS the label
        // itself, with nothing after it yet (a blank/unfilled template
        // field). Append the new value after the existing label text,
        // in plain (unstyled) formatting, instead of replacing the
        // paragraph — replacing would delete the label.
        const lastRun = runs[runs.length - 1];
        if (!lastRun) return;
        const needsSpace = fullText.length > 0 && !/\s$/.test(fullText);
        const newRunXml = buildRunXml('', `${needsSpace ? ' ' : ''}${newValue}`);
        const newBlock = block.replace(lastRun.rawXml, lastRun.rawXml + newRunXml);
        updatedXml = updatedXml.replace(block, newBlock);
        return;
      }

      // No colon, not emphasized — it was detected via the
      // adjacent-paragraph pass (a table cell, or a value on its own
      // line right after its label), so this paragraph's ENTIRE text
      // is the value with nothing else to preserve. Replace all runs
      // with a single new run carrying the new value, keeping the
      // first run's formatting.
      const firstRun = runs[0];
      if (!firstRun) return;

      const newBlock = block.replace(
        runs.map((r) => r.rawXml).join(''),
        buildRunXml(firstRun.rPrXml, newValue)
      );

      // The runs may not be perfectly contiguous in the raw XML (rare,
      // but possible with bookmarks/proofing tags between them) — fall
      // back to replacing the first run and stripping the rest if the
      // contiguous-join replace didn't match anything.
      if (newBlock !== block) {
        updatedXml = updatedXml.replace(block, newBlock);
      } else {
        let fallbackBlock = block.replace(firstRun.rawXml, buildRunXml(firstRun.rPrXml, newValue));
        for (let i = 1; i < runs.length; i++) {
          fallbackBlock = fallbackBlock.replace(runs[i].rawXml, '');
        }
        updatedXml = updatedXml.replace(block, fallbackBlock);
      }
      return;
    }

    const label = match[1];
    const colonIdx = fullText.indexOf(':', label.length - 5) >= 0 ? fullText.indexOf(':') : fullText.indexOf('：');
    if (colonIdx === -1) return;

    let valueStart = colonIdx + 1;
    while (valueStart < fullText.length && /\s/.test(fullText[valueStart])) valueStart++;

    const startRunIdx = runs.findIndex((r) => valueStart >= r.start && valueStart < r.end);
    if (startRunIdx === -1) {
      // No existing run covers the value position (e.g. an entirely empty
      // value like "Name:"). Append the new value to the last run's rPr
      // formatting, right after the label's run(s) — adding a space first
      // if the original text didn't already end with one.
      const lastRun = runs[runs.length - 1];
      if (!lastRun) return;
      const needsSpace = fullText.length > 0 && !/\s$/.test(fullText);
      const newRunXml = buildRunXml(lastRun.rPrXml, (needsSpace ? ' ' : '') + newValue);
      const newBlock = block.replace(lastRun.rawXml, lastRun.rawXml + newRunXml);
      updatedXml = updatedXml.replace(block, newBlock);
      return;
    }

    const startRun = runs[startRunIdx];
    const keepPrefixLen = valueStart - startRun.start;
    const prefixText = startRun.text.slice(0, keepPrefixLen);

    const prefixRunXml = prefixText ? buildRunXml(startRun.rPrXml, prefixText) : '';
    const newValueRunXml = buildRunXml(startRun.rPrXml, newValue);

    // Remove this run and every run after it (they made up the old value),
    // then insert the (optional) label-side prefix + the new value run in
    // their place.
    let newBlock = block.replace(startRun.rawXml, prefixRunXml + newValueRunXml);
    for (let i = startRunIdx + 1; i < runs.length; i++) {
      newBlock = newBlock.replace(runs[i].rawXml, '');
    }

    updatedXml = updatedXml.replace(block, newBlock);
  });

  zip.file('word/document.xml', updatedXml);
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

function buildRunXml(rPrXml: string, text: string): string {
  const encoded = encodeXmlEntities(text);
  return `<w:r>${rPrXml}<w:t xml:space="preserve">${encoded}</w:t></w:r>`;
}

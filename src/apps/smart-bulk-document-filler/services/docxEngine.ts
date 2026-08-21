import type { ParagraphModel } from '../types';

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

function detectBold(paragraphXml: string): boolean {
  return /<w:rPr>[\s\S]*?<w:b\/?>|<w:b\s+w:val="(1|true)"/.test(paragraphXml);
}

const LABEL_VALUE_PATTERN = /^([^:：]{1,60})[:：]\s*(.*)$/;

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
    if (!match) return;

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

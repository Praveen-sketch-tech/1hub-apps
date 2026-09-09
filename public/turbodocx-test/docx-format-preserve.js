/**
 * docx-format-preserve.js
 *
 * SECOND, INDEPENDENT DOCX generation path (does not touch/replace TurboDocx):
 *
 *   Original uploaded DOCX (OOXML/ZIP package)
 *     -> unzip (STORE or DEFLATE, via docx-postprocess.js's readZipUniversal)
 *     -> word/document.xml + word/header*.xml + word/footer*.xml
 *     -> parse as real XML (DOMParser), walk paragraphs/runs
 *     -> replace ONLY the placeholder text, run-by-run, preserving every
 *        run's <w:rPr> (bold/italic/underline/color/font/size/etc.)
 *     -> re-zip (STORE), every other OOXML part byte-identical to the
 *        original (styles.xml, numbering.xml, theme, media, fontTable,
 *        headers/footers structure, sectPr/page setup, tables, everything)
 *
 * This deliberately does NOT go through:
 *   DOCX -> plain text -> HTML/Markdown -> DOCX
 * which is what destroys bold/italic/underline/color/tables/numbering/
 * page layout in the legacy mammoth-extractRawText -> TurboDocx path.
 *
 * That legacy path (window.generateDocx / TurboDocx) is untouched and still
 * used exactly as before for documents that are authored/edited as HTML.
 * This module is only used for documents whose SOURCE is an uploaded .docx
 * and whose original bytes are still available client-side.
 */

import { readZipUniversal, writeZip } from '/turbodocx-test/docx-postprocess.js';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Matches both placeholder conventions already used across the app's
// templates: {key}, {{key}}, [key], [[key]] (1-2 brackets of either kind on
// each side). This mirrors the exact same convention user.js's HTML-preview
// path already understands, so a template behaves identically whichever
// generation path ends up handling it.
const PLACEHOLDER_REGEX = /[{[]{1,2}([^{}[\]]+)[}\]]{1,2}/g;

// ---------------------------------------------------------------------------
// Byte helpers
// ---------------------------------------------------------------------------

export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function utf8Encode(str) {
  return new TextEncoder().encode(str);
}

function utf8Decode(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

// ---------------------------------------------------------------------------
// Core: run-aware placeholder replacement inside one WordprocessingML part
// (word/document.xml, or a header/footer part - same schema for <w:p>).
// ---------------------------------------------------------------------------

/**
 * @param {string} xmlString - raw XML text of the part (e.g. word/document.xml)
 * @param {(key: string) => string|undefined} resolveValue - returns the
 *   replacement text for a placeholder key, or undefined to leave it as-is
 * @returns {{ xml: string, replacedCount: number }}
 */
export function replacePlaceholdersInPart(xmlString, resolveValue) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

  const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Could not parse DOCX XML part: ' + parserError.textContent);
  }

  const paragraphs = xmlDoc.getElementsByTagNameNS(WORD_NS, 'p');
  let replacedCount = 0;

  for (let p = 0; p < paragraphs.length; p++) {
    replacedCount += processParagraph(paragraphs[p], resolveValue);
  }

  const serialized = new XMLSerializer().serializeToString(xmlDoc);
  // XMLSerializer implementations vary: some already emit a leading
  // <?xml ...?> prolog, some don't. Strip any existing one first so we
  // never end up with two declarations (which is invalid XML and would
  // make Word treat the whole .docx as corrupt).
  const withoutProlog = serialized.replace(/^\s*<\?xml[^?]*\?>\s*/i, '');
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + withoutProlog;

  return { xml, replacedCount };
}

/**
 * A placeholder like {CUSTOMER_NAME} may be split across several <w:r> runs
 * by Word itself (this happens routinely from autocorrect/spellcheck/manual
 * edits), e.g.:
 *   <w:r><w:t>Dear {CUST</w:t></w:r><w:r><w:t>OMER_NAME}, ...</w:t></w:r>
 * so replacement must operate on the paragraph's full concatenated text,
 * then map each match back onto the specific <w:t> nodes/offsets it spans.
 */
function processParagraph(paragraphEl, resolveValue) {
  const textNodes = Array.from(paragraphEl.getElementsByTagNameNS(WORD_NS, 't'));
  if (textNodes.length === 0) return 0;

  // Build the paragraph's full text plus a map of [start, end) -> node.
  let fullText = '';
  const segments = []; // { node, start, end }
  for (const node of textNodes) {
    const text = node.textContent || '';
    segments.push({ node, start: fullText.length, end: fullText.length + text.length });
    fullText += text;
  }

  const matches = [];
  let m;
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((m = PLACEHOLDER_REGEX.exec(fullText)) !== null) {
    const key = m[1].trim();
    const value = resolveValue(key);
    if (value === undefined) continue; // unknown placeholder - leave untouched
    matches.push({ start: m.index, end: m.index + m[0].length, value: String(value) });
  }

  if (matches.length === 0) return 0;

  // Apply from LAST match to FIRST so earlier offsets in `segments` stay
  // valid while we mutate node text content in place.
  for (let i = matches.length - 1; i >= 0; i--) {
    applyMatchToSegments(matches[i], segments);
  }

  return matches.length;
}

function applyMatchToSegments(match, segments) {
  const touched = segments.filter((s) => s.end > match.start && s.start < match.end);
  if (touched.length === 0) return;

  touched.forEach((seg, idx) => {
    const original = seg.node.textContent || '';
    const localStart = Math.max(0, match.start - seg.start);
    const localEnd = Math.min(original.length, match.end - seg.start);
    const before = original.slice(0, localStart);
    const after = original.slice(localEnd);

    let next;
    if (idx === 0) {
      // First touched run: keep its own leading text, inject the full
      // replacement value here (using THIS run's formatting), drop the
      // placeholder portion that lived in this run.
      next = before + match.value + (touched.length === 1 ? after : '');
    } else if (idx === touched.length - 1) {
      // Last touched run: drop the placeholder portion, keep trailing text.
      next = after;
    } else {
      // A run entirely inside the placeholder span: nothing left to keep.
      next = '';
    }

    seg.node.textContent = next;
    // Force xml:space="preserve" so Word/LibreOffice never trims
    // leading/trailing spaces that came from the injected value.
    seg.node.setAttribute('xml:space', 'preserve');
  });
}

// ---------------------------------------------------------------------------
// Full DOCX transform
// ---------------------------------------------------------------------------

const REPLACEABLE_PART_PATTERN = /^word\/(document|header\d*|footer\d*)\.xml$/;

/**
 * @param {Object} params
 * @param {Uint8Array|string} params.originalBytes - original .docx bytes, or base64 string
 * @param {Record<string, string>} params.fieldValues - map of placeholder key -> value
 * @returns {Promise<Blob>}
 */
export async function generateFormatPreservingDocx({ originalBytes, fieldValues }) {
  const bytes =
    typeof originalBytes === 'string' ? base64ToUint8Array(originalBytes) : originalBytes;

  if (!bytes || bytes.length < 22) {
    throw new Error('Original document is missing or too small to be a valid DOCX.');
  }

  const entries = await readZipUniversal(bytes);

  const documentEntry = entries.find((e) => e.name === 'word/document.xml');
  if (!documentEntry) {
    throw new Error('This DOCX has no word/document.xml - it is not a valid Word document.');
  }

  const resolveValue = (key) => {
    if (Object.prototype.hasOwnProperty.call(fieldValues, key)) {
      const v = fieldValues[key];
      return v === undefined || v === null || v === '' ? undefined : v;
    }
    return undefined;
  };

  let totalReplacements = 0;

  for (const entry of entries) {
    if (entry.isDir || !REPLACEABLE_PART_PATTERN.test(entry.name)) continue;

    const xmlIn = utf8Decode(entry.bytes);
    const { xml: xmlOut, replacedCount } = replacePlaceholdersInPart(xmlIn, resolveValue);
    if (replacedCount > 0) {
      entry.bytes = utf8Encode(xmlOut);
      totalReplacements += replacedCount;
    }
  }

  if (totalReplacements === 0) {
    console.warn(
      'generateFormatPreservingDocx: no placeholders were replaced. ' +
      'Either every field was left empty, or the placeholder keys in the ' +
      'template do not match the field keys.'
    );
  }

  // Every part is written back out uncompressed (STORE). This keeps the
  // writer identical/reused from docx-postprocess.js and produces a fully
  // valid DOCX - Word and LibreOffice do not require DEFLATE, only a
  // structurally correct ZIP. Only the file size is slightly larger.
  const outBytes = writeZip(
    entries.map((e) => ({ name: e.name, bytes: e.bytes, isDir: e.isDir }))
  );

  return new Blob([outBytes], { type: DOCX_MIME });
}

window.generateFormatPreservingDocx = generateFormatPreservingDocx;

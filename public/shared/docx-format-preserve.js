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
  /*
   * CRITICAL:
   * Never parse and re-serialize the complete OOXML document.
   * We modify only the text content inside <w:t> elements.
   * Everything else remains byte-for-byte untouched.
   */

  const textTagRegex = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g;
  const nodes = [];

  let fullText = "";
  let tagMatch;

  while ((tagMatch = textTagRegex.exec(xmlString)) !== null) {
    const encodedText = tagMatch[2];
    const decodedText = decodeXmlText(encodedText);

    nodes.push({
      start: fullText.length,
      end: fullText.length + decodedText.length,
      contentStart: tagMatch.index + tagMatch[1].length,
      contentEnd: tagMatch.index + tagMatch[1].length + encodedText.length,
      text: decodedText
    });

    fullText += decodedText;
  }

  if (!nodes.length) {
    return { xml: xmlString, replacedCount: 0 };
  }

  /*
   * Find placeholders in the logical paragraph/text stream.
   * Values that are undefined are intentionally left untouched.
   */
  const matches = [];
  PLACEHOLDER_REGEX.lastIndex = 0;

  let placeholderMatch;

  while ((placeholderMatch = PLACEHOLDER_REGEX.exec(fullText)) !== null) {
    const key = placeholderMatch[1].trim();
    const value = resolveValue(key);

    if (value === undefined) continue;

    matches.push({
      start: placeholderMatch.index,
      end: placeholderMatch.index + placeholderMatch[0].length,
      value: String(value)
    });
  }

  if (!matches.length) {
    return { xml: xmlString, replacedCount: 0 };
  }

  /*
   * Calculate the final text for every affected <w:t>.
   * A placeholder may cross multiple runs.
   *
   * The replacement is placed in the first run touched by the
   * placeholder, so that run's original <w:rPr> formatting is retained.
   */
  const editsByNode = new Map();

  for (const match of matches) {
    const touched = nodes.filter(
      node => node.end > match.start && node.start < match.end
    );

    if (!touched.length) continue;

    touched.forEach((node, index) => {
      if (!editsByNode.has(node)) {
        editsByNode.set(node, []);
      }

      const localStart = Math.max(0, match.start - node.start);
      const localEnd = Math.min(
        node.text.length,
        match.end - node.start
      );

      editsByNode.get(node).push({
        start: localStart,
        end: localEnd,
        value: index === 0 ? match.value : ""
      });
    });
  }

  const replacements = [];

  for (const [node, edits] of editsByNode.entries()) {
    /*
     * Process edits from left to right.
     * Overlapping edits are skipped because they belong to the same
     * placeholder span.
     */
    edits.sort((a, b) => a.start - b.start);

    let result = "";
    let cursor = 0;

    for (const edit of edits) {
      if (edit.start < cursor) continue;

      result += node.text.slice(cursor, edit.start);
      result += edit.value;
      cursor = edit.end;
    }

    result += node.text.slice(cursor);

    replacements.push({
      start: node.contentStart,
      end: node.contentEnd,
      text: encodeXmlText(result)
    });
  }

  /*
   * Apply replacements from right to left so XML offsets remain valid.
   * No XML parsing. No XML serialization. No changes to <w:rPr>,
   * <w:pPr>, tables, sections, numbering, margins, etc.
   */
  replacements.sort((a, b) => b.start - a.start);

  let output = xmlString;

  for (const replacement of replacements) {
    output =
      output.slice(0, replacement.start) +
      replacement.text +
      output.slice(replacement.end);
  }

  return {
    xml: output,
    replacedCount: matches.length
  };
}

function decodeXmlText(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXmlText(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

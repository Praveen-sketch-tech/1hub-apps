/**
 * docx-postprocess.js
 *
 * Small, dependency-free helpers that sit AROUND the TurboDocx engine
 * (turbodocx.browser.esm.js) without modifying it. They fix issues found
 * during the TurboDocx browser-integration audit:
 *
 *   - normalizes whatever TurboDocx returns (Buffer-shim object / Uint8Array /
 *     ArrayBuffer / Blob) into one predictable Blob, instead of relying on the
 *     engine's internal `Object.prototype.hasOwnProperty.call(global,"Buffer")`
 *     branching, which silently changes behavior depending on page polyfills.
 *   - rejects empty / whitespace-only source HTML BEFORE calling the engine,
 *     so a blank editor can never produce a "successful" blank .docx.
 *   - after generation, opens the resulting .docx (a plain ZIP) and verifies
 *     word/document.xml actually contains visible, non-whitespace text —
 *     catching the "technically valid but blank" failure mode that a
 *     `blob.size < 100` check cannot catch (the empty-content skeleton is
 *     already ~20KB).
 *   - forces the page size in the final XML to A4, regardless of what was
 *     passed to (or silently defaulted by) the engine, so page size can never
 *     drift to US Letter.
 *   - patches word/styles.xml + word/fontTable.xml so Hindi (Devanagari) text
 *     gets a real complex-script font and correct `hi-IN` bidi language
 *     metadata — the engine hardcodes `w:cstheme="minorBidi"` and
 *     `w:bidi="ar-SA"` with no public option to change either, so this can
 *     only be fixed by editing the generated XML.
 *
 * No external libraries are used (no CDN, no npm dependency). TurboDocx's
 * ZIP output is written with the STORE (uncompressed) method — this module
 * reads and rewrites plain STORE-method ZIPs itself. If a future TurboDocx
 * version starts using DEFLATE, `readZip` throws a clear, loud error instead
 * of silently producing a corrupt file.
 */

// ---------------------------------------------------------------------------
// A4 page size, single source of truth for every caller.
// ---------------------------------------------------------------------------
export const A4 = Object.freeze({
  WIDTH_TWIPS: Math.round(8.27 * 1440),   // 11909
  HEIGHT_TWIPS: Math.round(11.69 * 1440), // 16834
});

export const DEFAULT_MARGINS_TWIPS = Object.freeze({
  top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0,
});

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const DEVANAGARI_RANGE = /[\u0900-\u097F]/;

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/** True if `html` has any real, visible, non-whitespace content. */
export function hasRenderableContent(html) {
  if (typeof html !== 'string') return false;
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > 0;
}

/** True if the given text contains any Devanagari (Hindi) characters. */
export function containsDevanagari(text) {
  return typeof text === 'string' && DEVANAGARI_RANGE.test(text);
}

// ---------------------------------------------------------------------------
// Normalizing whatever TurboDocx handed back into bytes
// ---------------------------------------------------------------------------

/** Turn a Blob / Uint8Array / ArrayBuffer / Buffer-shim into a Uint8Array. */
export async function toUint8Array(result) {
  if (!result) {
    throw new Error('TurboDocx returned an empty result.');
  }
  if (typeof Blob !== 'undefined' && result instanceof Blob) {
    return new Uint8Array(await result.arrayBuffer());
  }
  if (result instanceof Uint8Array) {
    return result;
  }
  if (result instanceof ArrayBuffer) {
    return new Uint8Array(result);
  }
  if (Array.isArray(result)) {
    return Uint8Array.from(result);
  }
  // Last resort: array-like / Buffer-shim object with numeric indices + length.
  if (typeof result.length === 'number') {
    return Uint8Array.from(result);
  }
  throw new Error(
    'Unrecognized TurboDocx result type: ' + Object.prototype.toString.call(result)
  );
}

// ---------------------------------------------------------------------------
// Minimal STORE-only ZIP reader/writer (no compression, matches TurboDocx's
// current output exactly, verified against real generated .docx files).
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readUInt32LE(view, offset) {
  return view.getUint32(offset, true);
}
function readUInt16LE(view, offset) {
  return view.getUint16(offset, true);
}

/**
 * Parses a ZIP (STORE method only) into an ordered array of
 * { name, bytes: Uint8Array }. Throws if any entry uses a compression
 * method other than STORE, rather than silently producing a broken file.
 */
function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Find End Of Central Directory record (signature 0x06054b50), scanning
  // from the end (it's the last record in the file, possibly after a
  // zero-length comment).
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  const maxCommentScan = Math.min(bytes.length, 65557);
  for (let i = bytes.length - 22; i >= bytes.length - maxCommentScan && i >= 0; i--) {
    if (readUInt32LE(view, i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Not a valid ZIP/DOCX file: End Of Central Directory not found.');
  }

  const entryCount = readUInt16LE(view, eocdOffset + 10);
  const centralDirOffset = readUInt32LE(view, eocdOffset + 16);

  const entries = [];
  let ptr = centralDirOffset;
  const CENTRAL_SIG = 0x02014b50;

  for (let i = 0; i < entryCount; i++) {
    if (readUInt32LE(view, ptr) !== CENTRAL_SIG) {
      throw new Error('Corrupt DOCX: unexpected central directory signature.');
    }
    const compressionMethod = readUInt16LE(view, ptr + 10);
    const nameLen = readUInt16LE(view, ptr + 28);
    const extraLen = readUInt16LE(view, ptr + 30);
    const commentLen = readUInt16LE(view, ptr + 32);
    const localHeaderOffset = readUInt32LE(view, ptr + 42);
    const nameBytes = bytes.subarray(ptr + 46, ptr + 46 + nameLen);
    const name = new TextDecoder('utf-8').decode(nameBytes);

    if (compressionMethod !== 0) {
      throw new Error(
        `Unsupported compression method (${compressionMethod}) for "${name}". ` +
        'This post-processor only supports STORE (uncompressed) ZIP entries, ' +
        'which is what the current TurboDocx build produces. Refusing to ' +
        'silently produce a corrupt file — please review before proceeding.'
      );
    }

    // Read the local file header to find where the actual file data starts.
    const LOCAL_SIG = 0x04034b50;
    if (readUInt32LE(view, localHeaderOffset) !== LOCAL_SIG) {
      throw new Error(`Corrupt DOCX: bad local file header for "${name}".`);
    }
    const localNameLen = readUInt16LE(view, localHeaderOffset + 26);
    const localExtraLen = readUInt16LE(view, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const uncompressedSize = readUInt32LE(view, ptr + 24);
    const dataEnd = dataStart + uncompressedSize;

    const isDir = name.endsWith('/');
    entries.push({
      name,
      bytes: isDir ? new Uint8Array(0) : bytes.slice(dataStart, dataEnd),
      isDir,
    });

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

/** Fixed DOS date/time (Jan 1 2020) — value is irrelevant to Word/LibreOffice. */
// ---------------------------------------------------------------------------
// Universal ZIP reader: supports STORE (0) AND DEFLATE (8).
//
// `readZip` above is intentionally STORE-only because it exactly matches
// TurboDocx's own output. It is NOT safe to reuse for arbitrary uploaded
// .docx files — real Word/LibreOffice documents are almost always DEFLATE
// (method 8), and feeding those bytes through the STORE-only reader would
// either throw (best case) or silently misread entry boundaries (worst
// case). This reader shares the exact same central-directory parsing logic,
// but decompresses DEFLATE entries with the browser's native
// DecompressionStream — no external ZIP/inflate library required, matching
// the dependency-free approach used everywhere else in this file.
// ---------------------------------------------------------------------------
export async function readZipUniversal(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  const maxCommentScan = Math.min(bytes.length, 65557);
  for (let i = bytes.length - 22; i >= bytes.length - maxCommentScan && i >= 0; i--) {
    if (readUInt32LE(view, i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Not a valid ZIP/DOCX file: End Of Central Directory not found.');
  }

  const entryCount = readUInt16LE(view, eocdOffset + 10);
  const centralDirOffset = readUInt32LE(view, eocdOffset + 16);
  const CENTRAL_SIG = 0x02014b50;
  const LOCAL_SIG = 0x04034b50;

  const rawEntries = [];
  let ptr = centralDirOffset;

  for (let i = 0; i < entryCount; i++) {
    if (readUInt32LE(view, ptr) !== CENTRAL_SIG) {
      throw new Error('Corrupt DOCX: unexpected central directory signature.');
    }
    const compressionMethod = readUInt16LE(view, ptr + 10);
    const compressedSize = readUInt32LE(view, ptr + 20);
    const uncompressedSize = readUInt32LE(view, ptr + 24);
    const nameLen = readUInt16LE(view, ptr + 28);
    const extraLen = readUInt16LE(view, ptr + 30);
    const commentLen = readUInt16LE(view, ptr + 32);
    const localHeaderOffset = readUInt32LE(view, ptr + 42);
    const nameBytes = bytes.subarray(ptr + 46, ptr + 46 + nameLen);
    const name = new TextDecoder('utf-8').decode(nameBytes);
    const isDir = name.endsWith('/');

    if (!isDir) {
      if (readUInt32LE(view, localHeaderOffset) !== LOCAL_SIG) {
        throw new Error(`Corrupt DOCX: bad local file header for "${name}".`);
      }
      const localNameLen = readUInt16LE(view, localHeaderOffset + 26);
      const localExtraLen = readUInt16LE(view, localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const dataEnd = dataStart + compressedSize;

      rawEntries.push({
        name,
        isDir: false,
        compressionMethod,
        compressedBytes: bytes.slice(dataStart, dataEnd),
        uncompressedSize,
      });
    } else {
      rawEntries.push({ name, isDir: true, compressionMethod: 0, compressedBytes: new Uint8Array(0), uncompressedSize: 0 });
    }

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  const entries = [];
  for (const e of rawEntries) {
    if (e.isDir) {
      entries.push({ name: e.name, bytes: new Uint8Array(0), isDir: true });
      continue;
    }
    if (e.compressionMethod === 0) {
      entries.push({ name: e.name, bytes: e.compressedBytes, isDir: false });
    } else if (e.compressionMethod === 8) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error(
          `Cannot read "${e.name}": this DOCX uses DEFLATE compression and this ` +
          'browser has no native DecompressionStream support (need Chrome/Edge 80+, ' +
          'Firefox 113+, or Safari 16.4+).'
        );
      }
      const stream = new Blob([e.compressedBytes]).stream()
        .pipeThrough(new DecompressionStream('deflate-raw'));
      const buffer = await new Response(stream).arrayBuffer();
      entries.push({ name: e.name, bytes: new Uint8Array(buffer), isDir: false });
    } else {
      throw new Error(
        `Unsupported ZIP compression method (${e.compressionMethod}) for "${e.name}". ` +
        'Only STORE and DEFLATE are supported by this reader.'
      );
    }
  }

  return entries;
}

const DOS_TIME = 0x0000;
const DOS_DATE = (2020 - 1980) << 9 | (1 << 5) | 1;

function writeUInt32LE(arr, offset, value) {
  arr[offset] = value & 0xff;
  arr[offset + 1] = (value >>> 8) & 0xff;
  arr[offset + 2] = (value >>> 16) & 0xff;
  arr[offset + 3] = (value >>> 24) & 0xff;
}
function writeUInt16LE(arr, offset, value) {
  arr[offset] = value & 0xff;
  arr[offset + 1] = (value >>> 8) & 0xff;
}

/** Rebuilds a STORE-method ZIP from an ordered array of {name, bytes, isDir}. */
export function writeZip(entries) {
  const encoder = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.isDir ? new Uint8Array(0) : entry.bytes;
    const crc = entry.isDir ? 0 : crc32(data);
    const size = data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    writeUInt32LE(local, 0, 0x04034b50);
    writeUInt16LE(local, 4, 20);      // version needed
    writeUInt16LE(local, 6, 0);       // flags
    writeUInt16LE(local, 8, 0);       // method: STORE
    writeUInt16LE(local, 10, DOS_TIME);
    writeUInt16LE(local, 12, DOS_DATE);
    writeUInt32LE(local, 14, crc);
    writeUInt32LE(local, 18, size);   // compressed size
    writeUInt32LE(local, 22, size);   // uncompressed size
    writeUInt16LE(local, 26, nameBytes.length);
    writeUInt16LE(local, 28, 0);      // extra len
    local.set(nameBytes, 30);

    localChunks.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    writeUInt32LE(central, 0, 0x02014b50);
    writeUInt16LE(central, 4, 20);    // version made by
    writeUInt16LE(central, 6, 20);    // version needed
    writeUInt16LE(central, 8, 0);     // flags
    writeUInt16LE(central, 10, 0);    // method: STORE
    writeUInt16LE(central, 12, DOS_TIME);
    writeUInt16LE(central, 14, DOS_DATE);
    writeUInt32LE(central, 16, crc);
    writeUInt32LE(central, 20, size);
    writeUInt32LE(central, 24, size);
    writeUInt16LE(central, 28, nameBytes.length);
    writeUInt16LE(central, 30, 0);    // extra len
    writeUInt16LE(central, 32, 0);    // comment len
    writeUInt16LE(central, 34, 0);    // disk number
    writeUInt16LE(central, 36, 0);    // internal attrs
    writeUInt32LE(central, 38, entry.isDir ? 0x10 : 0); // external attrs (dir flag)
    writeUInt32LE(central, 42, offset);
    central.set(nameBytes, 46);

    centralChunks.push(central);
    offset += local.length + data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of centralChunks) centralSize += c.length;

  const eocd = new Uint8Array(22);
  writeUInt32LE(eocd, 0, 0x06054b50);
  writeUInt16LE(eocd, 4, 0);
  writeUInt16LE(eocd, 6, 0);
  writeUInt16LE(eocd, 8, entries.length);
  writeUInt16LE(eocd, 10, entries.length);
  writeUInt32LE(eocd, 12, centralSize);
  writeUInt32LE(eocd, 16, centralStart);
  writeUInt16LE(eocd, 20, 0);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of localChunks) { out.set(c, pos); pos += c.length; }
  for (const c of centralChunks) { out.set(c, pos); pos += c.length; }
  out.set(eocd, pos);
  return out;
}

// ---------------------------------------------------------------------------
// DOCX-level helpers
// ---------------------------------------------------------------------------

const utf8 = new TextDecoder('utf-8');
const utf8Encoder = new TextEncoder();

function getEntryText(entries, name) {
  const entry = entries.find((e) => e.name === name);
  return entry ? utf8.decode(entry.bytes) : null;
}

function setEntryText(entries, name, text) {
  const entry = entries.find((e) => e.name === name);
  if (entry) entry.bytes = utf8Encoder.encode(text);
}

/** Extracts all visible text from a WordprocessingML document.xml string. */
export function extractVisibleText(documentXml) {
  const matches = documentXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
  let text = '';
  for (const m of matches) text += m[1];
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

/**
 * Validates + repairs a raw TurboDocx result and returns a ready-to-download
 * Blob. Throws (does not silently return a bad file) if the document has no
 * visible content, or if the ZIP structure can't be safely parsed.
 *
 * @param {Blob|Uint8Array|ArrayBuffer} rawResult - whatever HTMLToDOCX() returned
 * @param {object} [opts]
 * @param {string} [opts.bodyFont] - Latin/UI font to force (matches your preview font)
 * @param {string} [opts.hindiFont] - Devanagari-capable complex-script font
 * @returns {Promise<Blob>}
 */
export async function finalizeDocx(rawResult, opts = {}) {
  const { bodyFont = 'Segoe UI', hindiFont = 'Noto Sans Devanagari' } = opts;

  const bytes = await toUint8Array(rawResult);
  if (bytes.length < 22) {
    throw new Error('Generated DOCX is far too small to be a valid ZIP.');
  }

  const entries = readZip(bytes);

  let documentXml = getEntryText(entries, 'word/document.xml');
  if (!documentXml) {
    throw new Error(
      'Generated DOCX is missing word/document.xml — refusing to download a corrupt file.'
    );
  }

  // --- Content validation: must contain real, non-whitespace visible text ---
  const visibleText = extractVisibleText(documentXml).replace(/\s+/g, '');
  if (visibleText.length === 0) {
    throw new Error(
      'Generated DOCX has no visible text content (this would be a blank document). ' +
      'Add some content before exporting.'
    );
  }

  // --- Force A4 on every section properties block, regardless of what was
  //     passed to (or defaulted by) the engine. ---
  documentXml = documentXml.replace(
    /<w:pgSz\b[^/]*\/>/g,
    `<w:pgSz w:w="${A4.WIDTH_TWIPS}" w:h="${A4.HEIGHT_TWIPS}" w:orient="portrait"/>`
  );
  setEntryText(entries, 'word/document.xml', documentXml);

  // --- Fix default font + Hindi language metadata in styles.xml. The engine
  //     hardcodes w:cstheme="minorBidi" and w:bidi="ar-SA" with no public
  //     option to change either, so this can only be done here. ---
  const stylesXml = getEntryText(entries, 'word/styles.xml');
  if (stylesXml && /<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/.test(stylesXml)) {
    const patchedStyles = stylesXml.replace(
      /<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/,
      '<w:rPrDefault><w:rPr>' +
        `<w:rFonts w:ascii="${escapeXmlAttr(bodyFont)}" w:hAnsi="${escapeXmlAttr(bodyFont)}" ` +
        `w:eastAsia="${escapeXmlAttr(hindiFont)}" w:cs="${escapeXmlAttr(hindiFont)}"/>` +
        '<w:sz w:val="22"/><w:szCs w:val="22"/>' +
        '<w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="hi-IN"/>' +
      '</w:rPr></w:rPrDefault>'
    );
    setEntryText(entries, 'word/styles.xml', patchedStyles);
  }

  // --- Register the Devanagari font in fontTable.xml so Word/LibreOffice
  //     know it's a real font reference, not a missing/undeclared one. ---
  const fontsXml = getEntryText(entries, 'word/fontTable.xml');
  if (fontsXml && !fontsXml.includes(`w:name="${hindiFont}"`) && fontsXml.includes('</w:fonts>')) {
    const patchedFonts = fontsXml.replace(
      '</w:fonts>',
      `<w:font w:name="${escapeXmlAttr(hindiFont)}"><w:family w:val="auto"/><w:pitch w:val="variable"/></w:font></w:fonts>`
    );
    setEntryText(entries, 'word/fontTable.xml', patchedFonts);
  }

  const finalBytes = writeZip(entries);
  return new Blob([finalBytes], { type: DOCX_MIME });
}

function escapeXmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Exposed for tests / diagnostics only.
export const __internal = { readZip, writeZip, crc32 };

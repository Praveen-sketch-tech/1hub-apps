import type { CellRef } from '../types';
import { clean, isUsefulValue, looksLikeLabel, looksLikeSentence } from './fieldHeuristics';

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

function colLetter(ref: string): string {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  return match ? match[1] : '';
}

function rowNumber(ref: string): number {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  return match ? parseInt(match[2], 10) : 0;
}

function nextColLetter(col: string): string {
  // A -> B, Z -> AA, etc.
  let chars = col.split('');
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] !== 'Z') {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join('');
    }
    chars[i] = 'A';
    i--;
  }
  return 'A' + chars.join('');
}

interface SheetInfo {
  name: string;
  path: string;
}

async function getSharedStrings(zip: import('jszip')): Promise<string[]> {
  const file = zip.file('xl/sharedStrings.xml');
  if (!file) return [];
  const xml = await file.async('string');
  const matches = xml.match(/<si>[\s\S]*?<\/si>/g) || [];
  return matches.map((si) => {
    const tMatches = si.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g) || [];
    return decodeXmlEntities(tMatches.map((t) => t.replace(/<t(?:\s[^>]*)?>/, '').replace(/<\/t>/, '')).join(''));
  });
}

async function getSheetList(zip: import('jszip')): Promise<SheetInfo[]> {
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
  if (!workbookXml) {
    // Fallback: just use whatever sheet files exist.
    const files = Object.keys(zip.files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f));
    return files.map((path, i) => ({ name: `Sheet${i + 1}`, path }));
  }

  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  const relMap = new Map<string, string>();
  if (relsXml) {
    const relMatches = relsXml.match(/<Relationship[^>]*\/>/g) || [];
    relMatches.forEach((r) => {
      const idMatch = r.match(/Id="([^"]+)"/);
      const targetMatch = r.match(/Target="([^"]+)"/);
      if (idMatch && targetMatch) relMap.set(idMatch[1], targetMatch[1]);
    });
  }

  const sheetMatches = workbookXml.match(/<sheet\s[^>]*\/>/g) || [];
  return sheetMatches.map((s, i) => {
    const nameMatch = s.match(/name="([^"]+)"/);
    const ridMatch = s.match(/r:id="([^"]+)"/);
    const target = ridMatch ? relMap.get(ridMatch[1]) : undefined;
    let path = `xl/worksheets/sheet${i + 1}.xml`;
    if (target) {
      path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    }
    return { name: nameMatch ? nameMatch[1] : `Sheet${i + 1}`, path };
  });
}

export interface XlsxModel {
  sheets: SheetInfo[];
  sharedStrings: string[];
  cells: CellRef[];
}

function cellText(cellXml: string, sharedStrings: string[]): string {
  const typeMatch = cellXml.match(/<c[^>]*\st="([^"]+)"/);
  const type = typeMatch ? typeMatch[1] : 'n';
  const vMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
  const isMatch = cellXml.match(/<is>[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);

  if (type === 's' && vMatch) {
    const idx = parseInt(vMatch[1], 10);
    return decodeXmlEntities(sharedStrings[idx] || '');
  }
  if (type === 'inlineStr' && isMatch) {
    return decodeXmlEntities(isMatch[1]);
  }
  if (vMatch) {
    return decodeXmlEntities(vMatch[1]);
  }
  return '';
}

export async function parseXlsx(file: File): Promise<XlsxModel> {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const sheets = await getSheetList(zip);
  const sharedStrings = await getSharedStrings(zip);
  const cells: CellRef[] = [];

  for (const sheet of sheets) {
    const sheetFile = zip.file(sheet.path);
    if (!sheetFile) continue;
    const xml = await sheetFile.async('string');

    const rowMatches = xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];

    // Parse every row into its non-empty cells, keeping row order.
    const rows: Array<{ rowNum: number; cells: { ref: string; col: string; text: string }[] }> = [];

    rowMatches.forEach((rowXml) => {
      const rowRefMatch = rowXml.match(/<row\s+r="(\d+)"/);
      const cellMatches = rowXml.match(/<c[^>]*(?:\/>|>[\s\S]*?<\/c>)/g) || [];
      const rowCells: { ref: string; col: string; text: string }[] = [];

      cellMatches.forEach((cellXml) => {
        const refMatch = cellXml.match(/r="([A-Z]+\d+)"/);
        if (!refMatch) return;
        const text = cellText(cellXml, sharedStrings);
        if (!clean(text)) return;
        rowCells.push({ ref: refMatch[1], col: colLetter(refMatch[1]), text });
      });

      if (rowCells.length > 0) {
        rows.push({
          rowNum: rowRefMatch ? parseInt(rowRefMatch[1], 10) : rowNumber(rowCells[0].ref),
          cells: rowCells
        });
      }
    });

    // ------------------------------------------------------------
    // Mode 1: header row + single data row ("form-style" sheet) —
    // e.g. field names typed across row 1, one person's answers typed
    // into row 2 underneath, same columns. Detected structurally (which
    // columns are populated in each row), not by guessing at label text.
    // ------------------------------------------------------------
    if (rows.length === 2 && rows[0].cells.length >= 2) {
      const [headerRow, dataRow] = rows;
      const dataByCol = new Map(dataRow.cells.map((c) => [c.col, c]));

      const columnsMatch = headerRow.cells.every((h) => dataByCol.has(h.col));

      if (columnsMatch) {
        headerRow.cells.forEach((h) => {
          const d = dataByCol.get(h.col)!;
          const label = clean(h.text);
          const value = clean(d.text);
          if (!label || !isUsefulValue(value)) return;
          if (looksLikeSentence(label)) return;
          cells.push({ sheetName: sheet.name, ref: d.ref, label, value });
        });
        continue; // this sheet is fully handled by header/data pairing
      }
    }

    // ------------------------------------------------------------
    // Mode 2: vertical label/value rows — each row has exactly one
    // label cell and one value cell (not necessarily columns A/B; a
    // sheet with the label column shifted over, or a leading blank
    // column, still works).
    // ------------------------------------------------------------
    rows.forEach(({ cells: rowCells }) => {
      if (rowCells.length < 2) return;

      // Pair sequentially in column order: (label, value), (label, value)...
      // — handles the common single-pair row, and also a row that packs
      // more than one label/value pair across its columns.
      const sorted = [...rowCells].sort((a, b) => rowNumber(a.ref) - rowNumber(b.ref) || a.col.localeCompare(b.col));
      const pairCount = Math.floor(sorted.length / 2);

      for (let p = 0; p < pairCount; p++) {
        const labelCell = sorted[p * 2];
        const valueCell = sorted[p * 2 + 1];
        const label = clean(labelCell.text);
        const value = clean(valueCell.text);

        if (!label || !isUsefulValue(value)) continue;
        if (!looksLikeLabel(label) || looksLikeSentence(label)) continue;
        if (looksLikeSentence(value)) continue;

        cells.push({ sheetName: sheet.name, ref: valueCell.ref, label, value });
      }
    });
  }

  return { sheets, sharedStrings, cells };
}

/**
 * Replaces specific cell values in-place. Cells are always rewritten as
 * inline strings rather than shared-string references, so we never risk
 * corrupting a shared string that other, untouched cells still point to.
 */
export async function fillXlsx(file: File, replacements: Map<string, string>): Promise<Blob> {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sheets = await getSheetList(zip);

  // Group replacements by "sheetName::ref" so multi-sheet workbooks are
  // handled correctly.
  for (const sheet of sheets) {
    const sheetFile = zip.file(sheet.path);
    if (!sheetFile) continue;
    let xml = await sheetFile.async('string');
    let changed = false;

    replacements.forEach((newValue, key) => {
      const [sheetName, ref] = key.split('::');
      if (sheetName !== sheet.name) return;

      const newCellXml = `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${encodeXmlEntities(newValue)}</t></is></c>`;

      const cellRegex = new RegExp(`<c\\s+r="${ref}"[^>]*(?:/>|>[\\s\\S]*?</c>)`);
      const match = xml.match(cellRegex);
      if (match) {
        const styleMatch = match[0].match(/\ss="(\d+)"/);
        const styleAttr = styleMatch ? ` s="${styleMatch[1]}"` : '';
        const styledCellXml = `<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${encodeXmlEntities(
          newValue
        )}</t></is></c>`;
        xml = xml.replace(cellRegex, styledCellXml);
        changed = true;
        return;
      }

      // No <c> element exists yet for this ref (sparse/empty cell in a
      // blank template) — insert one into the correct row.
      const rowNum = rowNumber(ref);
      const rowRegex = new RegExp(`<row\\s+r="${rowNum}"[^>]*>[\\s\\S]*?<\\/row>`);
      const rowMatch = xml.match(rowRegex);
      if (rowMatch) {
        const updatedRow = rowMatch[0].replace('</row>', `${newCellXml}</row>`);
        xml = xml.replace(rowMatch[0], updatedRow);
        changed = true;
      }
    });

    if (changed) {
      zip.file(sheet.path, xml);
    }
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

export function cellReplacementKey(sheetName: string, ref: string): string {
  return `${sheetName}::${ref}`;
}

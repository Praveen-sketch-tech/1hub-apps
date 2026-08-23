/**
 * Shared, format-agnostic field-detection heuristics.
 *
 * These are used by both the PDF engine (pdfTextEngine.ts) and the DOCX
 * engine (docxEngine.ts) so a "this looks like a label" / "this looks
 * like a value" judgement behaves identically regardless of which file
 * format it came from — no duplicated, silently-diverging logic.
 */

export function clean(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function isUsefulValue(value: string): boolean {
  const v = clean(value);
  if (!v) return false;
  if (/^[_\-. ]+$/.test(v)) return false;
  return true;
}

/**
 * Generic label heuristic.
 *
 * Deliberately does NOT maintain a hard-coded list of document labels.
 * A label is inferred from structure, punctuation and typography instead.
 */
export function looksLikeLabel(value: string): boolean {
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
 * Detect a same-line/same-cell "label value" structure without requiring
 * a colon or equals sign — based on value characteristics, not a
 * document-specific label dictionary.
 */
export function looksLikeValue(value: string): boolean {
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

export function looksLikeSentence(value: string): boolean {
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

/**
 * Strong, unambiguous evidence that text is a *value* rather than a
 * label/heading — digits, currency, email, etc. Deliberately stricter
 * than looksLikeValue(), which also treats plain multi-word Title Case
 * phrases (including things like "Name of Company") as value-like and
 * is therefore too loose to use when telling a header row apart from
 * a data row.
 */
export function hasStrongValueSignal(value: string): boolean {
  const s = clean(value);
  if (!s) return false;
  if (/\d/.test(s)) return true;
  if (/@/.test(s)) return true;
  if (/[₹$€£]/.test(s)) return true;
  if (/\b(?:Rs|INR)\b/i.test(s)) return true;
  return false;
}

const MONTH_NAMES =
  'January|February|March|April|May|June|July|August|September|October|November|December';
const WEEKDAY_NAMES = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday';

/**
 * A small set of narrowly-scoped, well-established convention patterns
 * seen across many Indian formal documents (certificates, affidavits,
 * letters) — this is deliberately NOT a general-purpose sentence/NLP
 * entity extractor. Each pattern targets one specific, recognizable
 * phrasing, so the risk of a wrong match stays low:
 *
 *  1. A standalone written-out dateline (e.g. "Tuesday, March 11, 2025")
 *     with no label attached — common at the top of letters/certificates.
 *  2. The "Mr./Mrs./Miss <Name> S/O|D/O|W/O <Relation Name>" convention
 *     used to formally identify a person.
 *  3. The "since <date> as a/an <Designation>" convention used in
 *     experience/salary certificates.
 *
 * Anything not matching one of these specific phrasings is left alone —
 * this only ever adds fields, never overrides or removes ones found by
 * the structural (colon/table/row) passes.
 */
export function detectConventionFields(
  lines: string[]
): Array<{ label: string; value: string; confidence: number }> {
  const results: Array<{ label: string; value: string; confidence: number }> = [];

  const dateLinePattern = new RegExp(
    `^(?:(?:${WEEKDAY_NAMES}),?\\s+)?(?:${MONTH_NAMES})\\s+\\d{1,2},?\\s+\\d{4}$`,
    'i'
  );

  for (const rawLine of lines) {
    const line = clean(rawLine);
    if (!line) continue;
    if (dateLinePattern.test(line)) {
      results.push({ label: 'Date', value: line, confidence: 0.7 });
    }
  }

  const fullText = clean(lines.join(' '));

  // NOTE: deliberately NOT using the /i flag on these two patterns —
  // under /i, JavaScript's [A-Z] character class also matches lowercase
  // letters, which silently breaks the "must be a capitalized word" check
  // used to stop each name/designation capture at the right boundary
  // (e.g. it would swallow trailing lowercase words like "is working").
  // Case-insensitivity for the fixed keyword parts is instead spelled out
  // explicitly below.
  const nameRelationPattern =
    /\b(?:Mr|MR|mr|Mrs|MRS|mrs|Miss|MISS|miss|Ms|MS|ms)\.?\s+([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,3})\s+(S\/O|D\/O|W\/O|s\/o|d\/o|w\/o)\s+([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,3})/;
  const nameMatch = fullText.match(nameRelationPattern);
  if (nameMatch) {
    const personName = clean(nameMatch[1]);
    const relation = nameMatch[2].toUpperCase();
    const relationName = clean(nameMatch[3]);
    if (isUsefulValue(personName)) {
      results.push({ label: 'Name', value: personName, confidence: 0.68 });
    }
    if (isUsefulValue(relationName)) {
      const relLabel = relation === 'W/O' ? "Husband's Name" : "Father's Name";
      results.push({ label: relLabel, value: relationName, confidence: 0.65 });
    }
  }

  const sinceAsPattern =
    /\b(?:since|SINCE|Since)\s+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s+(?:as|AS|As)\s+(?:an|AN|An|a|A)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/;
  const sinceMatch = fullText.match(sinceAsPattern);
  if (sinceMatch) {
    const joiningDate = clean(sinceMatch[1]);
    const designation = clean(sinceMatch[2]);
    if (isUsefulValue(joiningDate)) {
      results.push({ label: 'Date of Joining', value: joiningDate, confidence: 0.68 });
    }
    if (isUsefulValue(designation) && !looksLikeSentence(designation)) {
      results.push({ label: 'Designation', value: designation, confidence: 0.65 });
    }
  }

  return results;
}

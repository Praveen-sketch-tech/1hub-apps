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

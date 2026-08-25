import type { FieldPair, FieldGroup } from '../types';

// Common synonym clusters for typical Indian company/legal documents — each
// inner array is one canonical concept. Any label that normalizes into one
// of these words gets bucketed together automatically, so "Name",
// "Full Name" and "Applicant Name" merge without the person having to
// manually link them.
const SYNONYM_GROUPS: string[][] = [
  ['name', 'full name', 'applicant name', 'employee name', 'candidate name'],
  ['father name', 'fathers name', "father's name", 'father'],
  ['date', 'date of birth', 'dob', 'birth date'],
  ['address', 'permanent address', 'current address', 'residential address'],
  ['phone', 'mobile', 'mobile number', 'contact number', 'phone number', 'contact'],
  ['email', 'email address', 'email id'],
  ['company', 'company name', 'organization', 'organisation', 'employer'],
  ['designation', 'position', 'job title', 'role'],
  ['employee id', 'emp id', 'employee number', 'id number', 'staff id'],
  ['pan', 'pan number', 'pan no'],
  ['aadhar', 'aadhaar', 'aadhar number', 'aadhaar number'],
  ['salary', 'ctc', 'annual salary', 'monthly salary'],
  ['city', 'town'],
  ['state', 'province'],
  ['pincode', 'pin code', 'zip code', 'postal code']
];

const SYNONYM_LOOKUP = new Map<string, string>();
SYNONYM_GROUPS.forEach((group) => {
  const canonical = group[0];
  group.forEach((term) => SYNONYM_LOOKUP.set(term, canonical));
});

export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalKey(normalized: string): string {
  if (SYNONYM_LOOKUP.has(normalized)) return SYNONYM_LOOKUP.get(normalized)!;
  // Containment fallback: only for multi-word synonym phrases (e.g.
  // "employee name" inside "our employee name"). Single generic words
  // like "name" or "employer" are deliberately excluded here — they're
  // common suffixes of many UNRELATED labels ("Manager Name", "PAN of
  // employer"), and matching on them merges distinct fields together,
  // silently hiding one value behind another with the same canonical
  // key. Single-word forms are already covered by the exact-match
  // lookup above.
  for (const [term, canonical] of SYNONYM_LOOKUP.entries()) {
    if (term.split(' ').length < 2) continue;
    if (normalized === term || normalized.endsWith(` ${term}`) || normalized.startsWith(`${term} `)) {
      return canonical;
    }
  }
  return normalized;
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function fuzzyKeyFor(normalized: string, existingKeys: string[]): string {
  const canon = canonicalKey(normalized);
  if (canon !== normalized) return canon; // matched via synonym dictionary

  // Otherwise, see if it's close enough (small edit distance relative to
  // length) to an already-seen key to merge automatically.
  for (const key of existingKeys) {
    const dist = levenshtein(normalized, key);
    const threshold = Math.max(1, Math.floor(Math.min(normalized.length, key.length) * 0.2));
    if (dist <= threshold) return key;
  }
  return normalized;
}

/**
 * Groups raw label:value pairs (gathered across many documents) into
 * canonical field groups, automatically merging near-identical or
 * known-synonym labels so the person doesn't have to do it by hand.
 */
export function groupFields(pairs: FieldPair[]): FieldGroup[] {
  const groups = new Map<string, FieldGroup>();

  pairs.forEach((pair) => {
    let key = fuzzyKeyFor(pair.normalizedLabel, Array.from(groups.keys()));

    // A synonym/fuzzy match is meant for the SAME real-world field worded
    // differently across different documents (e.g. "Full Name" vs
    // "Applicant Name" on two different filled samples). Within a SINGLE
    // document, though, two synonym-matched labels with DIFFERENT values
    // almost certainly mean two different people/entities that happen to
    // share a wording (e.g. one certificate's "Employee Name" and a
    // separately-extracted "Name" referring to someone else entirely) —
    // merging them would silently keep one value and drop the other. If
    // that conflict shows up, keep this pair under its own exact label
    // instead of the shared canonical one.
    const existingGroup = groups.get(key);
    if (existingGroup) {
      const conflictsWith = (g: FieldGroup) =>
        g.occurrences.some(
          (o) =>
            o.docIndex === pair.docIndex &&
            o.value.trim() &&
            pair.value.trim() &&
            o.value.trim() !== pair.value.trim()
        );

      if (conflictsWith(existingGroup)) {
        // Fall back toward this pair's own (unmerged) label. That alone
        // can still collide (e.g. the raw label "Name" already equals the
        // canonical key "name" it was trying to escape), so keep
        // disambiguating with a suffix until we land on a key that's
        // either free or doesn't conflict.
        let fallbackKey = pair.normalizedLabel;
        let suffix = 0;
        while (groups.has(fallbackKey) && conflictsWith(groups.get(fallbackKey)!)) {
          suffix += 1;
          fallbackKey = `${pair.normalizedLabel}__${suffix}`;
        }
        key = fallbackKey;
      }
    }

    if (!groups.has(key)) {
      groups.set(key, {
        id: `field-${groups.size + 1}`,
        displayLabel: pair.rawLabel,
        normalizedLabel: key,
        occurrences: [],
        suggestedValue: '',
        confidence: 0,
        varies: false
      });
    }
    groups.get(key)!.occurrences.push(pair);
  });

  groups.forEach((group) => {
    const valueCounts = new Map<string, number>();
    group.occurrences.forEach((occ) => {
      const v = occ.value.trim();
      if (!v) return;
      valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
    });

    let bestValue = '';
    let bestCount = 0;
    valueCounts.forEach((count, value) => {
      if (count > bestCount) {
        bestValue = value;
        bestCount = count;
      }
    });

    const totalWithValue = Array.from(valueCounts.values()).reduce((a, b) => a + b, 0);
    group.suggestedValue = bestValue;
    group.confidence = totalWithValue > 0 ? Math.round((bestCount / totalWithValue) * 100) : 0;
    // "Varies" = documents disagree on this field's value — likely a
    // per-document field (e.g. a reference number), not something
    // reusable across documents. Even a plain 50/50 split across just 2
    // documents is enough signal to flag this; it's not real agreement.
    group.varies = totalWithValue >= 2 && group.confidence < 60;
  });

  return Array.from(groups.values()).sort((a, b) => b.occurrences.length - a.occurrences.length);
}

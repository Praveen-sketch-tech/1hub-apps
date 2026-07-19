/**
 * Parses and validates page range strings for the Split tool, e.g.
 *   "1-3, 4-7, 8-10"
 *   "1, 3, 5-8"
 *
 * Ranges are 1-based (matching what a user would expect to type) and are
 * validated against the actual page count so we never crash on malformed
 * input, duplicates, reversed ranges, or out-of-bounds pages.
 */

import type { SplitRange } from '../types';

export interface ParsedSplitRanges {
  ranges: SplitRange[];
  errors: string[];
}

export function parseSplitRanges(input: string, totalPages: number): ParsedSplitRanges {
  const errors: string[] = [];
  const trimmed = input.trim();

  if (!trimmed) {
    return { ranges: [], errors: ['Enter at least one page or range, e.g. "1-3, 5, 8-10".'] };
  }

  const parts = trimmed
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length === 0) {
    return { ranges: [], errors: ['Enter at least one page or range, e.g. "1-3, 5, 8-10".'] };
  }

  const ranges: SplitRange[] = [];

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = part.match(/^(\d+)$/);

    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (start > end) {
        // Reversed range: normalize instead of failing, but tell the user.
        [start, end] = [end, start];
        errors.push(`Range "${part}" was reversed and has been read as ${start}-${end}.`);
      }
      if (start < 1 || end > totalPages) {
        errors.push(`Range "${part}" is outside the document's ${totalPages} page(s) and was skipped.`);
        continue;
      }
      ranges.push({ start, end });
    } else if (singleMatch) {
      const page = parseInt(singleMatch[1], 10);
      if (page < 1 || page > totalPages) {
        errors.push(`Page "${part}" is outside the document's ${totalPages} page(s) and was skipped.`);
        continue;
      }
      ranges.push({ start: page, end: page });
    } else {
      errors.push(`"${part}" is not a valid page or range and was skipped.`);
    }
  }

  if (ranges.length === 0 && errors.length === 0) {
    errors.push('No valid ranges found.');
  }

  return { ranges, errors };
}

/** Builds a human-readable, deduped filename suffix for a range, e.g. "pages-1-3". */
export function rangeLabel(range: SplitRange): string {
  return range.start === range.end ? `page-${range.start}` : `pages-${range.start}-${range.end}`;
}

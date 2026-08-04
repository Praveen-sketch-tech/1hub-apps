import type { RepoFile, DuplicateGroup, DuplicateOccurrence } from '../types';

const WINDOW_LINES = 8;
const MIN_OCCURRENCES = 3;
const MIN_NEAR_ONLY_OCCURRENCES = 4;
const MIN_CONFIDENCE = 55;
const MAX_REPORTED_GROUPS = 40;

// Tokens that carry structural meaning and must NOT be genericized away when
// building the "near duplicate" fingerprint — everything else (identifiers)
// gets replaced with a placeholder so renamed-variable copies still match.
const STRUCTURAL_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'switch', 'case', 'break', 'continue', 'class', 'extends', 'import', 'export',
  'from', 'default', 'new', 'this', 'typeof', 'instanceof', 'in', 'of', 'try',
  'catch', 'finally', 'throw', 'async', 'await', 'yield', 'void', 'delete',
  'null', 'undefined', 'true', 'false', 'interface', 'type', 'implements',
  'public', 'private', 'protected', 'readonly', 'static', 'enum', 'as',
  'React', 'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef'
]);

interface SignificantLine {
  lineNo: number;
  norm: string;
  struct: string;
}

interface WindowEntry {
  filePath: string;
  startLine: number;
  endLine: number;
  normLines: string[];
}

function preprocessFile(content: string): SignificantLine[] {
  const rawLines = content.split('\n');
  const result: SignificantLine[] = [];

  rawLines.forEach((raw, idx) => {
    let line = raw.replace(/\/\/.*$/, '').trim();
    if (!line || /^[{}();,]*$/.test(line)) return;

    const norm = line.replace(/\s+/g, ' ');
    const struct = normalizeStructural(norm);
    result.push({ lineNo: idx + 1, norm, struct });
  });

  return result;
}

function normalizeStructural(line: string): string {
  let s = line;
  s = s.replace(/'([^'\\]|\\.)*'|"([^"\\]|\\.)*"|`([^`\\]|\\.)*`/g, 'STR');
  s = s.replace(/\b\d+(\.\d+)?\b/g, 'NUM');
  s = s.replace(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g, (token) =>
    STRUCTURAL_KEYWORDS.has(token) ? token : 'ID'
  );
  return s.replace(/\s+/g, ' ').trim();
}

export function detectCodeDuplication(files: RepoFile[]): DuplicateGroup[] {
  const structMap = new Map<string, WindowEntry[]>();

  files.forEach((file) => {
    if (!(file.path.endsWith('.ts') || file.path.endsWith('.tsx') || file.path.endsWith('.js') || file.path.endsWith('.jsx'))) {
      return;
    }
    const sig = preprocessFile(file.content);
    if (sig.length < WINDOW_LINES) return;

    for (let i = 0; i <= sig.length - WINDOW_LINES; i++) {
      const windowLines = sig.slice(i, i + WINDOW_LINES);
      const structKey = windowLines.map((l) => l.struct).join('\n');
      // Skip windows that are almost entirely genericized (e.g. all "ID ID ID")
      // — these are too generic to be a meaningful duplicate.
      if (structKey.split('ID').join('').trim().length < 30) continue;

      const entry: WindowEntry = {
        filePath: file.path,
        startLine: windowLines[0].lineNo,
        endLine: windowLines[windowLines.length - 1].lineNo,
        normLines: windowLines.map((l) => l.norm)
      };

      if (!structMap.has(structKey)) structMap.set(structKey, []);
      structMap.get(structKey)!.push(entry);
    }
  });

  const rawGroups: { key: string; entries: WindowEntry[] }[] = [];
  structMap.forEach((entries, key) => {
    if (entries.length >= MIN_OCCURRENCES) {
      rawGroups.push({ key, entries });
    }
  });

  const merged = rawGroups.map(({ entries }) => mergeOverlappingOccurrences(entries));

  const groups: DuplicateGroup[] = merged
    .map(({ occurrences, normLinesByFile }, idx) => {
      const allNorm = occurrences.map((o) => normLinesByFile.get(occurrenceKey(o)) || []);
      const kind: 'exact' | 'near' = allSameText(allNorm) ? 'exact' : 'near';
      const confidence = kind === 'exact' ? 100 : estimateConfidence(allNorm);
      const representativeCode = allNorm[0]?.join('\n') || '';

      return {
        id: `dup-${idx + 1}`,
        kind,
        confidence,
        lineCount: WINDOW_LINES,
        occurrences: occurrences.map((o) => ({ filePath: o.filePath, startLine: o.startLine, endLine: o.endLine })),
        suggestedModuleName: suggestModulePath(representativeCode, idx),
        representativeCode
      };
    })
    .filter((g) => g.kind === 'exact' || (g.confidence >= MIN_CONFIDENCE && g.occurrences.length >= MIN_NEAR_ONLY_OCCURRENCES))
    .sort((a, b) => b.occurrences.length - a.occurrences.length || b.confidence - a.confidence)
    .slice(0, MAX_REPORTED_GROUPS);

  return groups;
}

function occurrenceKey(o: WindowEntry): string {
  return `${o.filePath}:${o.startLine}`;
}

function mergeOverlappingOccurrences(entries: WindowEntry[]): {
  occurrences: WindowEntry[];
  normLinesByFile: Map<string, string[]>;
} {
  const byFile = new Map<string, WindowEntry[]>();
  entries.forEach((e) => {
    if (!byFile.has(e.filePath)) byFile.set(e.filePath, []);
    byFile.get(e.filePath)!.push(e);
  });

  const merged: WindowEntry[] = [];
  const normLinesByFile = new Map<string, string[]>();

  byFile.forEach((list, filePath) => {
    list.sort((a, b) => a.startLine - b.startLine);
    let current: WindowEntry | null = null;

    list.forEach((entry) => {
      if (!current) {
        current = { ...entry };
        return;
      }
      if (entry.startLine <= current.endLine + 1) {
        // Overlapping/adjacent — extend the merged block.
        if (entry.endLine > current.endLine) {
          current.normLines = entry.normLines;
        }
        current.endLine = Math.max(current.endLine, entry.endLine);
      } else {
        merged.push(current);
        normLinesByFile.set(occurrenceKey(current), current.normLines);
        current = { ...entry };
      }
    });

    if (current) {
      merged.push(current);
      normLinesByFile.set(occurrenceKey(current), (current as WindowEntry).normLines);
    }
  });

  return { occurrences: merged, normLinesByFile };
}

function allSameText(allNorm: string[][]): boolean {
  if (allNorm.length === 0) return true;
  const first = allNorm[0].join('\n');
  return allNorm.every((lines) => lines.join('\n') === first);
}

function estimateConfidence(allNorm: string[][]): number {
  if (allNorm.length < 2) return 100;
  const first = allNorm[0];
  let totalRatio = 0;
  let count = 0;

  for (let i = 1; i < allNorm.length; i++) {
    const other = allNorm[i];
    const maxLen = Math.max(first.length, other.length) || 1;
    let matchingLines = 0;
    for (let j = 0; j < Math.min(first.length, other.length); j++) {
      if (first[j] === other[j]) matchingLines++;
    }
    totalRatio += matchingLines / maxLen;
    count++;
  }

  const avgRatio = count > 0 ? totalRatio / count : 0.5;
  return Math.round(avgRatio * 100);
}

function suggestModulePath(code: string, idx: number): string {
  const fnMatch = code.match(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)/) || code.match(/const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/);
  const name = fnMatch ? fnMatch[1] : `sharedHelper${idx + 1}`;
  return `src/shared/utils/${name}.ts`;
}

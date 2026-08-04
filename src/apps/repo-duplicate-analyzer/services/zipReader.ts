import type { RepoFile } from '../types';

const RELEVANT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const MAX_FILE_CHARS = 2_000_000; // ~2MB of text per file guard
const MAX_TOTAL_FILES = 4000;
const SKIP_PATH_SEGMENTS = ['node_modules/', '/.git/', '/dist/', '/build/', '/.next/', '/coverage/'];

export interface ZipReadResult {
  files: RepoFile[];
  totalEntries: number;
  skippedLarge: string[];
}

export async function readRepoZip(file: File): Promise<ZipReadResult> {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const zip = await JSZip.loadAsync(file);

  const files: RepoFile[] = [];
  const skippedLarge: string[] = [];
  let totalEntries = 0;

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    totalEntries++;

    const path = entry.name;
    if (SKIP_PATH_SEGMENTS.some((seg) => path.includes(seg)) || path.startsWith('.git/')) continue;

    const ext = RELEVANT_EXTENSIONS.find((e) => path.endsWith(e));
    const isManifest = path.endsWith('manifest.json');
    if (!ext && !isManifest) continue;

    if (files.length >= MAX_TOTAL_FILES) {
      skippedLarge.push(path);
      continue;
    }

    let content: string;
    try {
      content = await entry.async('string');
    } catch {
      skippedLarge.push(path);
      continue;
    }

    if (content.length > MAX_FILE_CHARS) {
      skippedLarge.push(path);
      continue;
    }

    files.push({ path, content });
  }

  return { files: stripCommonRootFolder(files), totalEntries, skippedLarge };
}

/**
 * If someone zips their repo folder directly, every entry ends up prefixed
 * with a wrapper folder (e.g. "1hub-apps-main/src/..."). Strip that single
 * common prefix so path-based checks (e.g. "src/apps/...") work the same
 * regardless of how the zip was created.
 */
function stripCommonRootFolder(files: RepoFile[]): RepoFile[] {
  if (files.length === 0) return files;
  const firstSegments = files.map((f) => f.path.split('/')[0]);
  const allSame = firstSegments.every((s) => s === firstSegments[0]);
  if (!allSame || firstSegments[0] === 'src') return files;

  const root = firstSegments[0];
  return files
    .filter((f) => f.path.includes('/'))
    .map((f) => ({ ...f, path: f.path.slice(root.length + 1) }));
}

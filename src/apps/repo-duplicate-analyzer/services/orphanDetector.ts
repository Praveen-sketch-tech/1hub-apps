import type { RepoFile, OrphanIssue } from '../types';

export function detectOrphans(files: RepoFile[]): OrphanIssue[] {
  const issues: OrphanIssue[] = [];
  const registryFile = files.find((f) => f.path.endsWith('src/core/apps/appRegistry.ts'));
  if (!registryFile) return issues;

  const registeredIds = new Set<string>();
  const idRegex = /id:\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = idRegex.exec(registryFile.content))) {
    registeredIds.add(m[1]);
  }

  const appFolders = new Set<string>();
  files.forEach((f) => {
    const match = f.path.match(/^src\/apps\/([^/]+)\//);
    if (match) appFolders.add(match[1]);
  });

  appFolders.forEach((slug) => {
    if (!registeredIds.has(slug)) {
      issues.push({
        kind: 'unregistered-folder',
        message: `Folder "src/apps/${slug}/" exists but has no entry in appRegistry.ts — it can never be opened by users.`
      });
    }
  });

  registeredIds.forEach((id) => {
    if (!appFolders.has(id)) {
      issues.push({
        kind: 'missing-folder',
        message: `appRegistry.ts has an entry for "${id}" but no matching "src/apps/${id}/" folder was found in the zip.`
      });
    }
  });

  return issues;
}

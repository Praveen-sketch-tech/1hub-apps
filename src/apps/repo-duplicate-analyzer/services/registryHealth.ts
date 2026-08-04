import type { RepoFile, RegistryIssue } from '../types';

export function isHubAppsRepo(files: RepoFile[]): boolean {
  return files.some((f) => f.path.endsWith('src/core/apps/appRegistry.ts'));
}

export function checkRegistryHealth(files: RepoFile[]): RegistryIssue[] {
  const issues: RegistryIssue[] = [];

  const registryFile = files.find((f) => f.path.endsWith('src/core/apps/appRegistry.ts'));
  const loadersFile = files.find((f) => f.path.endsWith('src/core/apps/appLoaders.ts'));
  const chatModulesFile = files.find((f) => f.path.endsWith('src/core/chat/appChatModules.ts'));

  if (!registryFile) return issues;

  const ids = extractAll(registryFile.content, /id:\s*["']([^"']+)["']/g);
  const numbers = extractAll(registryFile.content, /number:\s*["']?(\d+)["']?/g);

  findDuplicates(ids).forEach((id) =>
    issues.push({ severity: 'error', message: `Duplicate app id "${id}" appears more than once in appRegistry.ts.` })
  );

  findDuplicates(numbers).forEach((num) =>
    issues.push({ severity: 'error', message: `Duplicate app number "${num}" appears more than once in appRegistry.ts.` })
  );

  if (loadersFile) {
    ids.forEach((id) => {
      const inLoaders =
        loadersFile.content.includes(`@apps/${id}`) ||
        loadersFile.content.includes(`"/apps/${id}"`) ||
        loadersFile.content.includes(`'/apps/${id}'`);
      if (!inLoaders) {
        issues.push({
          severity: 'error',
          message: `App "${id}" is registered in appRegistry.ts but has no matching entry in appLoaders.ts — it will never load.`
        });
      }
    });
  } else {
    issues.push({ severity: 'warning', message: 'appLoaders.ts was not found in the uploaded zip — could not verify registry/loader sync.' });
  }

  const appsWithChatActions = files
    .filter((f) => /^src\/apps\/[^/]+\/chatActions\.ts$/.test(f.path))
    .map((f) => f.path.match(/^src\/apps\/([^/]+)\//)![1]);

  if (chatModulesFile) {
    appsWithChatActions.forEach((slug) => {
      const registered = chatModulesFile.content.includes(`'${slug}'`) || chatModulesFile.content.includes(`"${slug}"`);
      if (!registered) {
        issues.push({
          severity: 'warning',
          message: `App "${slug}" has a chatActions.ts file but is not registered in appChatModules.ts.`
        });
      }
    });
  }

  files
    .filter((f) => /^src\/apps\/[^/]+\/manifest\.json$/.test(f.path))
    .forEach((f) => {
      try {
        const parsed = JSON.parse(f.content);
        if (typeof parsed.number !== 'string') {
          issues.push({
            severity: 'warning',
            message: `${f.path}: "number" should be a quoted string (e.g. "041"), found ${typeof parsed.number}.`
          });
        }
        (['id', 'name', 'description', 'path', 'category'] as const).forEach((field) => {
          if (!parsed[field]) {
            issues.push({ severity: 'warning', message: `${f.path}: missing required field "${field}".` });
          }
        });
      } catch {
        issues.push({ severity: 'error', message: `${f.path}: could not be parsed as valid JSON.` });
      }
    });

  return issues;
}

function extractAll(content: string, regex: RegExp): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content))) {
    results.push(m[1]);
  }
  return results;
}

function findDuplicates(arr: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  arr.forEach((v) => {
    if (seen.has(v)) dups.add(v);
    seen.add(v);
  });
  return Array.from(dups);
}

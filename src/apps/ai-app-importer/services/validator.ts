import { ParsedFileItem, ParsedFile, ValidationResult, AppManifest } from '../types';

export function validateParsedFiles(files: (ParsedFileItem | ParsedFile)[], existingRegistry: any[] = []): ValidationResult {
  const errors: string[] = [];
  const fileErrors: Record<string, string> = {};
  let manifest: AppManifest | undefined;

  if (files.length === 0) {
    errors.push('No files detected. Paste code containing FILE blocks or Markdown snippets.');
    return { isValid: false, errors, fileErrors };
  }

  const pathSet = new Set<string>();

  files.forEach((f) => {
    if (!f.path) {
      errors.push('A file with an empty path was found.');
      return;
    }

    if (!f.path.startsWith('src/')) {
      const err = 'File path must start with "src/apps/<app-slug>/"';
      fileErrors[f.path] = err;
      errors.push(`${f.path}: ${err}`);
    }

    if (pathSet.has(f.path)) {
      const err = 'Duplicate file path detected';
      fileErrors[f.path] = err;
      errors.push(`${f.path}: ${err}`);
    }
    pathSet.add(f.path);

    if (!f.content || f.content.trim().length === 0) {
      const err = 'File content is empty';
      fileErrors[f.path] = err;
      errors.push(`${f.path}: ${err}`);
    }

    if (f.path.endsWith('.tsx') || f.path.endsWith('.ts')) {
      const openBraces = (f.content.match(/\{/g) || []).length;
      const closeBraces = (f.content.match(/\}/g) || []).length;
      if (Math.abs(openBraces - closeBraces) > 10) {
        const err = `Syntax Warning: Brace mismatch (${openBraces} '{' vs ${closeBraces} '}')`;
        fileErrors[f.path] = err;
        errors.push(`${f.path}: ${err}`);
      }
    }
  });

  const manifestFile = files.find((f) => f.path.endsWith('manifest.json'));
  if (manifestFile) {
    try {
      manifest = JSON.parse(manifestFile.content);
      if (manifest) {
        if (!manifest.id) errors.push('manifest.json: Missing "id" field');
        if (!manifest.number) errors.push('manifest.json: Missing "number" field');
        if (!manifest.name) errors.push('manifest.json: Missing "name" field');

        if (Array.isArray(existingRegistry) && existingRegistry.length > 0) {
          const dupSlug = existingRegistry.find((a) => a.id === manifest?.id);
          if (dupSlug) {
            errors.push(`Duplicate App Slug "${manifest.id}" already exists in registry.`);
          }
          const dupNum = existingRegistry.find((a) => a.number === manifest?.number);
          if (dupNum) {
            errors.push(`Duplicate App Number "${manifest.number}" is already assigned to "${dupNum.name}".`);
          }
        }
      }
    } catch {
      errors.push('manifest.json: Invalid JSON format');
    }
  }

  const indexFile = files.find((f) => f.path.endsWith('index.tsx') || f.path.endsWith('index.ts'));
  if (!indexFile) {
    errors.push('Missing main entry point (index.tsx)');
  } else if (!indexFile.content.includes('export default') && !indexFile.content.includes('export const')) {
    fileErrors[indexFile.path] = 'Main index.tsx must export a React component.';
    errors.push('index.tsx: Missing React component export');
  }

  return {
    isValid: errors.length === 0,
    errors,
    fileErrors,
    manifest
  };
}

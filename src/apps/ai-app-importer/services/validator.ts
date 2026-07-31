import { ParsedFileItem } from './parser';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  fileErrors: Record<string, string>;
}

export function validateParsedFiles(files: ParsedFileItem[]): ValidationResult {
  const errors: string[] = [];
  const fileErrors: Record<string, string> = {};

  if (files.length === 0) {
    errors.push('No files found to validate.');
    return { isValid: false, errors, fileErrors };
  }

  const paths = new Set<string>();

  files.forEach((f) => {
    if (!f.path) {
      errors.push('File found with empty path');
      return;
    }

    if (!f.path.startsWith('src/')) {
      const err = 'Path must start with src/';
      fileErrors[f.path] = err;
      errors.push(`${f.path}: ${err}`);
    }

    if (paths.has(f.path)) {
      const err = 'Duplicate file path';
      fileErrors[f.path] = err;
      errors.push(`${f.path}: ${err}`);
    }
    paths.add(f.path);

    if (!f.content || f.content.trim().length === 0) {
      const err = 'File content is empty';
      fileErrors[f.path] = err;
      errors.push(`${f.path}: ${err}`);
    }
  });

  const hasIndex = files.some((f) => f.path.endsWith('index.tsx') || f.path.endsWith('index.ts'));
  if (!hasIndex) {
    errors.push('Missing main entry point (index.tsx or index.ts)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    fileErrors
  };
}

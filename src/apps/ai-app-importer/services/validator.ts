import { ParsedFileItem, ParsedFile, ValidationResult, AppManifest } from '../types';
import type { AppDefinition } from '@core/apps/appRegistry';

/**
 * Scans source text for a "${" interpolation marker that is NOT actually
 * inside a backtick template literal — i.e. the exact corruption pattern
 * where an AI response has its backticks stripped and
 *   `Hello ${name}`
 * becomes
 *   Hello ${name}
 * which is invalid JS/TS (or silently wrong, e.g. inside a plain string).
 * Returns the 1-based line number of the first offending occurrence, or
 * null if none is found. This is a lightweight single-pass scanner, not a
 * full parser, but it reliably catches this specific, recurring failure
 * mode without needing a real TypeScript compiler in the browser.
 */
function findBrokenInterpolationLine(content: string): number | null {
  let inTemplate = false;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let inRegex = false;
  let inRegexClass = false;
  let line = 1;
  // Tracks the last non-whitespace character seen, used to guess whether a
  // "/" starts a regex literal (as opposed to being a division operator).
  let lastSignificant = '';
  const regexPrecedingChars = new Set([
    '(', ',', '=', ':', '!', '&', '|', '?', '{', ';', '[', '+', '-', '*', '%', '<', '>', '\0'
  ]);

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const prev = content[i - 1];

    if (ch === '\n') {
      line++;
      inLineComment = false;
      continue;
    }

    if (inLineComment) continue;

    if (inBlockComment) {
      if (ch === '/' && prev === '*') inBlockComment = false;
      continue;
    }

    // Inside a /regex/ literal, backticks/quotes are just literal
    // characters (e.g. /`([^`]+)`/g matching Markdown inline-code) and
    // must NOT toggle template/string state.
    if (inRegex) {
      if (ch === '\\') {
        i++; // skip the escaped character
        continue;
      }
      if (ch === '[') {
        inRegexClass = true;
        continue;
      }
      if (ch === ']') {
        inRegexClass = false;
        continue;
      }
      if (ch === '/' && !inRegexClass) {
        inRegex = false;
        let j = i + 1;
        while (j < content.length && /[a-z]/i.test(content[j])) j++;
        i = j - 1;
      }
      continue;
    }

    if (!inTemplate && !inSingle && !inDouble) {
      if (ch === '/' && content[i + 1] === '/') {
        inLineComment = true;
        continue;
      }
      if (ch === '/' && content[i + 1] === '*') {
        inBlockComment = true;
        continue;
      }
      if (ch === '/' && regexPrecedingChars.has(lastSignificant)) {
        inRegex = true;
        continue;
      }
    }

    if (!inTemplate && !inDouble && ch === "'" && prev !== '\\') {
      inSingle = !inSingle;
      lastSignificant = ch;
      continue;
    }
    if (!inTemplate && !inSingle && ch === '"' && prev !== '\\') {
      inDouble = !inDouble;
      lastSignificant = ch;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`' && prev !== '\\') {
      inTemplate = !inTemplate;
      lastSignificant = ch;
      continue;
    }

    if (!inTemplate && !inSingle && !inDouble && ch === '{' && prev === '$') {
      return line;
    }

    if (!/\s/.test(ch)) lastSignificant = ch;
  }

  return null;
}

export function validateParsedFiles(
  files: (ParsedFileItem | ParsedFile)[],
  existingRegistry: AppDefinition[] = []
): ValidationResult {
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

      // Catch the recurring "AI stripped the backticks" bug: ${...} used
      // outside of an actual template literal (e.g. className={px-6 ${x}}
      // instead of className={`px-6 ${x}`}).
      const brokenLine = findBrokenInterpolationLine(f.content);
      if (brokenLine !== null) {
        const err = `Broken template literal near line ${brokenLine}: "\${...}" is used without surrounding backticks (\`). This usually means the AI output had its backticks stripped — wrap the string in backticks.`;
        fileErrors[f.path] = err;
        errors.push(`${f.path}: ${err}`);
      }

      // Catch invalid union type ordering, e.g. useState<File null |>(null)
      // instead of useState<File | null>(null).
      const badUnionMatch = f.content.match(/<\s*\w+\s+(?:null|undefined)\s*\|\s*>/);
      if (badUnionMatch) {
        const err = `Invalid TypeScript union type syntax "${badUnionMatch[0]}" — should be written as "<Type | null>".`;
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

  // chatActions.ts must use the app's real chat contract from
  // @core/chat/types instead of inventing its own shape — this was the
  // exact cause of a prior tsc build failure (missing "appId", wrong
  // context/return shape).
  const chatActionsFile = files.find((f) => f.path.endsWith('chatActions.ts'));
  if (chatActionsFile) {
    const content = chatActionsFile.content;
    const importsCoreTypes = /from\s+['"]@core\/chat\/types['"]/.test(content);
    const definesLocalTypes = /interface\s+(ChatAction|AppChatModule|ChatActionContext|ChatExecutionResult)\b/.test(content);

    if (!importsCoreTypes) {
      const err = "chatActions.ts must import AppChatModule, ChatActionContext, and ChatExecutionResult from '@core/chat/types' instead of defining its own types.";
      fileErrors[chatActionsFile.path] = err;
      errors.push(`${chatActionsFile.path}: ${err}`);
    } else if (definesLocalTypes) {
      const err = "chatActions.ts defines its own ChatAction/AppChatModule/ChatActionContext/ChatExecutionResult interface(s), which conflicts with '@core/chat/types'. Remove the local interfaces and use the imported ones.";
      fileErrors[chatActionsFile.path] = err;
      errors.push(`${chatActionsFile.path}: ${err}`);
    }

    if (/context\.query\b|context\.payload\b/.test(content)) {
      const err = 'chatActions.ts uses "context.query"/"context.payload" — the real contract uses "context.input" (and optional "context.file").';
      fileErrors[chatActionsFile.path] = err;
      errors.push(`${chatActionsFile.path}: ${err}`);
    }

    if (!/appId\s*:/.test(content)) {
      const err = 'chatActions.ts: each chat action (and the module itself) must include an "appId" field matching the app slug.';
      fileErrors[chatActionsFile.path] = err;
      errors.push(`${chatActionsFile.path}: ${err}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    fileErrors,
    manifest
  };
}

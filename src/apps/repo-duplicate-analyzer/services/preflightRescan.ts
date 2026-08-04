import type { RepoFile, PreflightIssue } from '../types';

// Ported from ai-app-importer/services/validator.ts's findBrokenInterpolationLine
// so this app can re-scan an entire existing repo, not just newly-pasted files.
function findBrokenInterpolationLine(content: string): number | null {
  let inTemplate = false;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let inRegex = false;
  let inRegexClass = false;
  let line = 1;
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

    if (inRegex) {
      if (ch === '\\') {
        i++;
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

export function rescanForKnownBugs(files: RepoFile[]): PreflightIssue[] {
  const issues: PreflightIssue[] = [];

  files.forEach((f) => {
    if (!(f.path.endsWith('.ts') || f.path.endsWith('.tsx'))) return;

    const brokenLine = findBrokenInterpolationLine(f.content);
    if (brokenLine !== null) {
      issues.push({
        filePath: f.path,
        message: `Possible broken template literal near line ${brokenLine} — "\${...}" used outside backticks.`
      });
    }

    const badUnion = f.content.match(/<\s*\w+\s+(?:null|undefined)\s*\|\s*>/);
    if (badUnion) {
      issues.push({ filePath: f.path, message: `Invalid TypeScript union type syntax "${badUnion[0]}".` });
    }

    if (f.path.endsWith('chatActions.ts')) {
      const importsCoreTypes = /from\s+['"]@core\/chat\/types['"]/.test(f.content);
      const definesLocalTypes = /interface\s+(ChatAction|AppChatModule|ChatActionContext|ChatExecutionResult)\b/.test(f.content);
      if (!importsCoreTypes) {
        issues.push({ filePath: f.path, message: "chatActions.ts does not import from '@core/chat/types'." });
      } else if (definesLocalTypes) {
        issues.push({ filePath: f.path, message: "chatActions.ts defines its own local chat types instead of using '@core/chat/types'." });
      }
    }
  });

  return issues;
}

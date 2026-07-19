import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/apps');
const problems = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.css')) {
      const text = fs.readFileSync(file, 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (/prefers-color-scheme\s*:\s*dark|(^|\s)\.dark\s/.test(line)) problems.push(`${file}:${i + 1}: app-local dark theme rule`);
        if (/--(?:card-bg|text-color|button-bg|input-bg|border-color)\s*:\s*(?!var\(--tool-)/.test(line)) problems.push(`${file}:${i + 1}: legacy token not mapped to --tool-*`);
      });
    }
  }
};
walk(root);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Theme contract audit passed.');

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  const codeBlocks: string[] = [];
  let working = markdown.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
    const escapedCode = escapeHtml(code.replace(/\n$/, ''));
    const langLabel = lang ? escapeHtml(lang) : '';
    const index = codeBlocks.length;
    const label = langLabel
      ? `<div class="bg-slate-800 text-slate-400 text-xs px-4 py-1.5 font-mono uppercase tracking-wider border-b border-slate-700">${langLabel}</div>`
      : '';
    codeBlocks.push(
      `<div class="my-4 rounded-lg overflow-hidden border border-slate-800 bg-slate-900">${label}<pre class="p-4 overflow-x-auto text-slate-100 font-mono text-sm"><code>${escapedCode}</code></pre></div>`
    );
    return `\n__CODE_BLOCK_${index}__\n`;
  });

  const formatInline = (text: string): string => {
    let s = escapeHtml(text);
    s = s.replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded font-mono text-xs">$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del class="line-through text-slate-400">$1</del>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:underline font-semibold">$1</a>');
    return s;
  };

  const lines = working.split('\n');
  const html: string[] = [];
  let inUl = false;
  let inOl = false;
  let inQuote = false;
  let quoteLines: string[] = [];

  const closeUl = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
  };
  const closeOl = () => {
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };
  const closeQuote = () => {
    if (inQuote) {
      const body = quoteLines.map((l) => formatInline(l)).join('<br/>');
      html.push(`<blockquote class="border-l-4 border-indigo-500 bg-indigo-50 text-slate-700 italic pl-4 py-2 my-4 rounded-r-md">${body}</blockquote>`);
      quoteLines = [];
      inQuote = false;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    const codeBlockMatch = trimmed.match(/^__CODE_BLOCK_(\d+)__$/);
    if (codeBlockMatch) {
      closeQuote();
      closeUl();
      closeOl();
      html.push(codeBlocks[parseInt(codeBlockMatch[1], 10)] || '');
      continue;
    }

    if (/^(---|\*\*\*|___)$/.test(trimmed)) {
      closeQuote();
      closeUl();
      closeOl();
      html.push('<hr class="my-6 border-t-2 border-slate-200" />');
      continue;
    }

    if (rawLine.startsWith('>')) {
      closeUl();
      closeOl();
      inQuote = true;
      quoteLines.push(rawLine.replace(/^>\s?/, ''));
      continue;
    } else {
      closeQuote();
    }

    const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      closeUl();
      closeOl();
      const level = headingMatch[1].length;
      const titleText = formatInline(headingMatch[2]);
      const sizeClass =
        level === 1
          ? 'text-3xl font-extrabold mt-6 mb-4 pb-2 border-b border-slate-200'
          : level === 2
          ? 'text-2xl font-bold mt-5 mb-3 pb-1 border-b border-slate-100'
          : 'text-lg font-bold mt-4 mb-2';
      html.push(`<h${level} class="${sizeClass}">${titleText}</h${level}>`);
      continue;
    }

    const ulMatch = rawLine.match(/^\s*[-*+]\s+(.*)/);
    if (ulMatch) {
      closeOl();
      if (!inUl) {
        html.push('<ul class="list-disc list-inside space-y-1 my-3 pl-1">');
        inUl = true;
      }
      html.push(`<li>${formatInline(ulMatch[1])}</li>`);
      continue;
    } else {
      closeUl();
    }

    const olMatch = rawLine.match(/^\s*\d+\.\s+(.*)/);
    if (olMatch) {
      closeUl();
      if (!inOl) {
        html.push('<ol class="list-decimal list-inside space-y-1 my-3 pl-1">');
        inOl = true;
      }
      html.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    } else {
      closeOl();
    }

    if (trimmed === '') {
      html.push('<div class="h-2"></div>');
      continue;
    }

    html.push(`<p class="my-2 leading-relaxed">${formatInline(rawLine)}</p>`);
  }

  closeQuote();
  closeUl();
  closeOl();

  return html.join('\n');
}

export function generateFullHtmlDocument(bodyHtml: string, title: string = 'Markdown Export'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.6; padding: 2.5rem 1rem; }
  .container { max-width: 820px; margin: 0 auto; background: #fff; padding: 2.5rem; border-radius: 12px; border: 1px solid #e2e8f0; }
</style>
</head>
<body>
<main class="container">
${bodyHtml}
</main>
</body>
</html>`;
}
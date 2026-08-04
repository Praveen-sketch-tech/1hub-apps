import React, { useState, useMemo } from 'react';
import { Download, FileText, Trash2, FileCode } from 'lucide-react';
import { parseMarkdownToHtml, generateFullHtmlDocument } from './utils/markdown';

const DEFAULT_MARKDOWN = `# Markdown Live Previewer

Welcome! Type **Markdown** on the left and see it rendered live on the right.

## Features

- Live side-by-side preview
- **Bold**, *italic*, and \`inline code\`
- [Links](https://example.com)
- Code blocks:

\`\`\`typescript
function hello(name: string) {
  return "Hello, " + name;
}
\`\`\`

> Built with a custom regex parser — no external Markdown library.
`;

export function MarkdownLivePreviewerPage() {
  const [markdown, setMarkdown] = useState<string>(DEFAULT_MARKDOWN);

  const renderedHtml = useMemo(() => parseMarkdownToHtml(markdown), [markdown]);

  const stats = useMemo(() => {
    const chars = markdown.length;
    const words = markdown.trim() ? markdown.trim().split(/\s+/).filter(Boolean).length : 0;
    return { chars, words };
  }, [markdown]);

  const handleDownloadHtml = () => {
    const fullDocument = generateFullHtmlDocument(renderedHtml);
    const blob = new Blob([fullDocument], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'markdown-preview.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'document.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-800 font-sans">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-lg">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900 leading-none">Markdown Live Previewer</h1>
            <p className="text-xs text-slate-500 mt-0.5">{stats.words} words · {stats.chars} characters</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadMarkdown}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center gap-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            Save .md
          </button>
          <button
            onClick={handleDownloadHtml}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Download HTML
          </button>
          <button
            onClick={() => setMarkdown('')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-600 flex items-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          className="w-1/2 h-full p-4 font-mono text-sm bg-slate-900 text-slate-100 resize-none outline-none border-r border-slate-800"
          placeholder="Type Markdown here..."
          spellCheck={false}
        />
        <div className="w-1/2 h-full overflow-y-auto p-6 bg-white">
          <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        </div>
      </div>
    </div>
  );
}

export default MarkdownLivePreviewerPage;
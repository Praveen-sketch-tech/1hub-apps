import React, { useState } from 'react';

export interface ParsedFile {
  path: string;
  content: string;
  status: 'valid' | 'invalid';
  error?: string;
}

interface ParserProps {
  files: ParsedFile[];
  onUpdateFile: (index: number, newContent: string) => void;
  onDeleteFile: (index: number) => void;
}

export const Parser: React.FC<ParserProps> = ({ files, onUpdateFile, onDeleteFile }) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
        <p className="text-xs font-mono">No parsed files yet. Paste content and click "Parse Files".</p>
      </div>
    );
  }

  const activeFile = files[selectedIndex] || files[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-3">
      <div className="border-r border-slate-800 pr-2 overflow-y-auto space-y-1">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Parsed Files ({files.length})</h3>
        {files.map((f, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedIndex(idx)}
            className={`flex items-center justify-between p-2 rounded-lg text-xs font-mono cursor-pointer transition ${
              selectedIndex === idx ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <span className="truncate max-w-[180px]" title={f.path}>{f.path}</span>
            <div className="flex items-center space-x-1">
              {f.status === 'invalid' && <span className="w-2 h-2 rounded-full bg-rose-500" title={f.error} />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFile(idx);
                  if (selectedIndex >= files.length - 1) setSelectedIndex(Math.max(0, files.length - 2));
                }}
                className="text-slate-500 hover:text-rose-400 px-1 font-bold"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="md:col-span-2 flex flex-col h-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/50">
          <span className="text-xs font-mono text-indigo-400">{activeFile?.path}</span>
          {activeFile?.error && <span className="text-[10px] text-rose-400 font-mono">{activeFile.error}</span>}
        </div>
        <textarea
          value={activeFile?.content || ''}
          onChange={(e) => onUpdateFile(selectedIndex, e.target.value)}
          className="flex-1 w-full p-3 bg-slate-950 text-emerald-400 font-mono text-xs outline-none resize-none"
        />
      </div>
    </div>
  );
};

import React from 'react';

interface TextEditorProps {
  value: string;
  onChange: (val: string) => void;
  onParse: () => void;
  isParsing?: boolean;
}

export const TextEditor: React.FC<TextEditorProps> = ({
  value,
  onChange,
  onParse,
  isParsing = false
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Raw Prompt Output Paste Area</span>
        <button
          onClick={onParse}
          disabled={!value.trim() || isParsing}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
        >
          {isParsing ? 'Parsing Output...' : 'Parse Files'}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste LLM output containing ===== FILE: path/to/file ===== content here..."
        className="flex-1 w-full p-4 bg-slate-900 text-slate-100 font-mono text-xs outline-none resize-none placeholder-slate-600 focus:ring-0"
      />
    </div>
  );
};

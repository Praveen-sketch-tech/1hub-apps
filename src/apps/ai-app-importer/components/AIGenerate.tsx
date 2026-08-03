import React from 'react';
import { Sparkles } from 'lucide-react';

interface AIGenerateProps {
  description: string;
  onDescriptionChange: (v: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export const AIGenerate: React.FC<AIGenerateProps> = ({
  description,
  onDescriptionChange,
  onGenerate,
  isGenerating
}) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
      <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Generate App with AI</h2>
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Describe your app... e.g. Create Calculator App"
        rows={3}
        className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-indigo-500 resize-none"
      />
      <button
        type="button"
        onClick={onGenerate}
        disabled={!description.trim() || isGenerating}
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition shadow-lg shadow-indigo-600/20 active:scale-95"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {isGenerating ? 'Generating App...' : 'Generate App'}
      </button>
    </div>
  );
};

import React from 'react';
import { ParsedFile } from './Parser';

interface PreviewProps {
  files: ParsedFile[];
  isValid: boolean;
  validationErrors: string[];
  deployStatus: string;
  previewUrl: string;
  onValidate: () => void;
  onGenerate: () => void;
  onPushGitHub: () => void;
  isDeploying: boolean;
}

export const Preview: React.FC<PreviewProps> = ({
  files,
  isValid,
  validationErrors,
  deployStatus,
  previewUrl,
  onValidate,
  onGenerate,
  onPushGitHub,
  isDeploying
}) => {
  return (
    <div className="flex flex-col space-y-4 p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Deployment & Pipeline Control</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={onValidate}
            disabled={files.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition active:scale-95"
          >
            Validate
          </button>
          <button
            onClick={onGenerate}
            disabled={files.length === 0 || !isValid}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition active:scale-95"
          >
            Generate Local
          </button>
          <button
            onClick={onPushGitHub}
            disabled={files.length === 0 || !isValid || isDeploying}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition shadow-lg shadow-purple-600/20 active:scale-95"
          >
            {isDeploying ? 'Deploying...' : 'Push & Deploy'}
          </button>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs font-mono space-y-1">
          <span className="font-bold">Validation Issues:</span>
          <ul className="list-disc pl-4 space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {deployStatus && (
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-500">Pipeline Status</span>
          <span className="text-xs font-mono text-cyan-400">{deployStatus}</span>
        </div>
      )}

      {previewUrl && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-400">Deployed Successfully!</span>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 underline font-mono hover:text-indigo-300"
          >
            {previewUrl}
          </a>
        </div>
      )}
    </div>
  );
};

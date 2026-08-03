import React from 'react';
import { AIProvider } from '../types';
import { getProviderLabel } from '../services/ai';

interface ApiCredentialsProps {
  provider: AIProvider;
  apiKey: string;
  connected: boolean;
  validating: boolean;
  error: string;
  onProviderChange: (p: AIProvider) => void;
  onApiKeyChange: (key: string) => void;
  onValidate: () => void;
}

const PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'google'];

export const ApiCredentials: React.FC<ApiCredentialsProps> = ({
  provider,
  apiKey,
  connected,
  validating,
  error,
  onProviderChange,
  onApiKeyChange,
  onValidate
}) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">AI Generation — API Credentials</h2>
        <span
          className={`text-[10px] font-mono px-2 py-1 rounded-full border ${
            connected
              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
              : 'bg-slate-950 border-slate-800 text-slate-500'
          }`}
        >
          {connected ? 'Connected' : 'Not Connected'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <select
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as AIProvider)}
          className="p-2 rounded bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {getProviderLabel(p)}
            </option>
          ))}
        </select>
        <input
          type="password"
          placeholder="API Key"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          className="p-2 rounded bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={onValidate}
          disabled={validating || !apiKey.trim()}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition active:scale-95"
        >
          {validating ? 'Validating...' : 'Validate Connection'}
        </button>
      </div>

      {error && <p className="text-[11px] font-mono text-rose-400">{error}</p>}

      <p className="text-[10px] text-slate-500">
        Stored only in this browser's local storage. Never sent to any 1Hub server.
      </p>
    </div>
  );
};

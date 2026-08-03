import React from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { PipelineStep } from '../types';

interface PipelineProgressProps {
  steps: PipelineStep[];
}

export const PipelineProgress: React.FC<PipelineProgressProps> = ({ steps }) => {
  const hasStarted = steps.some((s) => s.status !== 'pending');
  if (!hasStarted) return null;

  return (
    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
      <span className="text-[10px] font-mono uppercase text-slate-500">AI Generation Pipeline</span>
      <ul className="space-y-1">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-2 text-xs font-mono">
            {step.status === 'done' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
            {step.status === 'active' && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0 mt-0.5" />}
            {step.status === 'error' && <X className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
            {step.status === 'pending' && (
              <span className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0 mt-0.5" />
            )}
            <span className="flex flex-col">
              <span
                className={
                  step.status === 'done'
                    ? 'text-slate-300'
                    : step.status === 'active'
                    ? 'text-indigo-300'
                    : step.status === 'error'
                    ? 'text-rose-300'
                    : 'text-slate-600'
                }
              >
                {step.label}
              </span>
              {step.detail && <span className="text-slate-500 text-[10px]">{step.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

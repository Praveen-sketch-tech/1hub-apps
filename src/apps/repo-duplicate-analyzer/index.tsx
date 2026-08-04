export { chatModule } from './chatActions';
import React, { useState } from 'react';
import {
  GitCompare,
  Upload,
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Download,
  AlertTriangle,
  FileWarning,
  Package,
  Map as MapIcon
} from 'lucide-react';
import { analyzeRepo, freshAnalysisSteps } from './services/analyzer';
import { buildPatch } from './services/patchGenerator';
import { buildPatchZip } from './services/patchZip';
import { downloadBlob, downloadText } from '@shared/utils/downloads';
import type { AnalysisResult, AnalysisStep } from './types';

function StepRow({ step }: { step: AnalysisStep }) {
  return (
    <li className="flex items-start gap-2 text-xs font-mono">
      {step.status === 'done' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
      {step.status === 'active' && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0 mt-0.5" />}
      {step.status === 'error' && <X className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
      {step.status === 'pending' && <span className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0 mt-0.5" />}
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
  );
}

function Section({
  title,
  count,
  children,
  defaultOpen
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800/60 transition"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {title}
        </span>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{count}</span>
      </button>
      {open && <div className="p-3 pt-0 space-y-2">{children}</div>}
    </div>
  );
}

export default function RepoDuplicateAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [steps, setSteps] = useState<AnalysisStep[]>(freshAnalysisSteps());
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [selectedDupIds, setSelectedDupIds] = useState<string[]>([]);
  const [patchStatus, setPatchStatus] = useState('');
  const [isGeneratingPatch, setIsGeneratingPatch] = useState(false);

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setResult(null);
    setError('');
    setSelectedDupIds([]);
    setPatchStatus('');
  };

  const handleAnalyze = async () => {
    if (!file || isAnalyzing) return;
    setIsAnalyzing(true);
    setError('');
    setResult(null);
    setSteps(freshAnalysisSteps());

    try {
      const analysis = await analyzeRepo(file, setSteps);
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed — the zip may be corrupted or too large.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleDup = (id: string) => {
    setSelectedDupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleGeneratePatch = async () => {
    if (!result || selectedDupIds.length === 0 || isGeneratingPatch) return;
    setIsGeneratingPatch(true);
    setPatchStatus('Building patch...');

    try {
      const patch = buildPatch(result.duplicateGroups, selectedDupIds);
      const blob = await buildPatchZip(patch);
      const ok = downloadBlob(blob, 'refactor-patch.zip');
      setPatchStatus(
        ok
          ? `Patch generated: ${patch.moduleFiles.length} module file(s). Only "exact" groups are included in the auto-apply script; "near" groups are documented for manual review.`
          : 'Patch was built but the download was blocked by the browser — check your download settings.'
      );
    } catch (err) {
      setPatchStatus(`Patch generation failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setIsGeneratingPatch(false);
    }
  };

  const handleDownloadRepoMap = () => {
    if (!result) return;
    downloadText(result.repoMapMarkdown, 'REPO_MAP.md', 'text/markdown;charset=utf-8');
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-white p-4 font-sans space-y-4 overflow-y-auto">
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
        <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
          <GitCompare className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base">Repo Duplicate &amp; Capability Analyzer</h1>
          <p className="text-xs text-slate-400">
            Upload a repo zip — everything is analyzed locally in your browser, nothing is uploaded anywhere.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-700 rounded-lg p-6 cursor-pointer hover:border-indigo-500 transition">
          <Upload className="w-6 h-6 text-slate-500" />
          <span className="text-sm text-slate-300 font-medium">{file ? file.name : 'Choose repo .zip file'}</span>
          <span className="text-[11px] text-slate-500">Only .ts/.tsx/.js/.jsx and manifest.json files are read</span>
          <input
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          />
        </label>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!file || isAnalyzing}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition active:scale-95"
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Repo'}
        </button>

        {error && <p className="text-xs font-mono text-rose-400">{error}</p>}
      </div>

      {steps.some((s) => s.status !== 'pending') && (
        <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 space-y-1.5">
          <ul className="space-y-1">
            {steps.map((s) => (
              <StepRow key={s.id} step={s} />
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Health Summary */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-600/10 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-white">{result.relevantFiles}</div>
              <div className="text-[10px] text-slate-400">Files scanned</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">{result.duplicateGroups.length}</div>
              <div className="text-[10px] text-slate-400">Code duplicate groups</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">{result.capabilityGroups.length}</div>
              <div className="text-[10px] text-slate-400">Capability overlaps</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">
                {result.registryIssues.length + result.orphanIssues.length + result.preflightIssues.length}
              </div>
              <div className="text-[10px] text-slate-400">Health issues</div>
            </div>
          </div>

          {result.skippedLargeFiles.length > 0 && (
            <p className="text-[11px] font-mono text-amber-400">
              Skipped {result.skippedLargeFiles.length} file(s) that were too large to analyze.
            </p>
          )}

          {/* Code Duplication */}
          <Section title="Code Duplication" count={result.duplicateGroups.length} defaultOpen>
            {result.duplicateGroups.length === 0 && <p className="text-xs text-slate-500">No duplicate code blocks found.</p>}
            {result.duplicateGroups.map((group) => (
              <div key={group.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          group.kind === 'exact' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                        }`}
                      >
                        {group.kind === 'exact' ? 'Exact match' : `Near match ~${group.confidence}%`}
                      </span>
                      <span className="text-xs text-slate-400">{group.occurrences.length} occurrences</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 font-mono">Suggested: {group.suggestedModuleName}</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0">
                    <input
                      type="checkbox"
                      checked={selectedDupIds.includes(group.id)}
                      onChange={() => toggleDup(group.id)}
                      className="accent-indigo-600"
                    />
                    Include
                  </label>
                </div>
                <ul className="text-[11px] font-mono text-slate-500 space-y-0.5">
                  {group.occurrences.slice(0, 6).map((occ, i) => (
                    <li key={i}>
                      {occ.filePath}:{occ.startLine}-{occ.endLine}
                    </li>
                  ))}
                  {group.occurrences.length > 6 && <li>...and {group.occurrences.length - 6} more</li>}
                </ul>
              </div>
            ))}

            {result.duplicateGroups.length > 0 && (
              <button
                type="button"
                onClick={handleGeneratePatch}
                disabled={selectedDupIds.length === 0 || isGeneratingPatch}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition active:scale-95"
              >
                <Package className="w-3.5 h-3.5" />
                {isGeneratingPatch ? 'Generating...' : `Generate Patch (${selectedDupIds.length} selected)`}
              </button>
            )}
            {patchStatus && <p className="text-[11px] text-slate-400">{patchStatus}</p>}
          </Section>

          {/* Capability Duplication */}
          <Section title="Capability Duplication" count={result.capabilityGroups.length}>
            {result.capabilityGroups.length === 0 && (
              <p className="text-xs text-slate-500">No repeated capability implementations found across 3+ apps.</p>
            )}
            {result.capabilityGroups.map((group) => (
              <div key={group.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-1.5">
                <p className="text-sm font-semibold text-slate-200">{group.category}</p>
                <p className="text-xs text-slate-400">{group.description}</p>
                <p className="text-xs font-mono text-slate-300">Suggested: {group.suggestedModuleName}</p>
                <ul className="text-[11px] font-mono text-slate-500 space-y-0.5">
                  {group.occurrences.map((occ, i) => (
                    <li key={i}>
                      {occ.appSlug} — {occ.filePath}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Section>

          {/* Registry Health (only for 1Hub Apps repos) */}
          {result.isHubAppsRepo && (
            <Section title="Registry Health (1Hub Apps)" count={result.registryIssues.length + result.orphanIssues.length}>
              {result.registryIssues.length === 0 && result.orphanIssues.length === 0 && (
                <p className="text-xs text-emerald-400">No registry issues found.</p>
              )}
              {result.registryIssues.map((issue, i) => (
                <div key={`ri-${i}`} className="flex items-start gap-2 text-xs">
                  <AlertTriangle
                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${issue.severity === 'error' ? 'text-rose-400' : 'text-amber-400'}`}
                  />
                  <span className="text-slate-300">{issue.message}</span>
                </div>
              ))}
              {result.orphanIssues.map((issue, i) => (
                <div key={`oi-${i}`} className="flex items-start gap-2 text-xs">
                  <FileWarning className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">{issue.message}</span>
                </div>
              ))}
            </Section>
          )}

          {/* Bundle & Dependency Risks */}
          <Section title="Bundle & Dependency Risks" count={result.bundleRisks.length}>
            {result.bundleRisks.length === 0 && <p className="text-xs text-slate-500">No heavy-dependency risks found.</p>}
            {result.bundleRisks.map((risk, i) => (
              <div key={i} className="text-xs text-slate-300">
                <span className="font-mono text-amber-400">{risk.library}</span> in {risk.filePath}
                <p className="text-slate-500">{risk.note}</p>
              </div>
            ))}
          </Section>

          {/* Pre-flight Re-scan */}
          <Section title="Pre-flight Re-scan (known bug patterns)" count={result.preflightIssues.length}>
            {result.preflightIssues.length === 0 && <p className="text-xs text-emerald-400">No known bug patterns found.</p>}
            {result.preflightIssues.map((issue, i) => (
              <div key={i} className="text-xs text-slate-300">
                <span className="font-mono text-slate-500">{issue.filePath}</span> — {issue.message}
              </div>
            ))}
          </Section>

          {/* Repo Understanding Pack */}
          <Section title="Repo Understanding Pack" count={result.functionInventory.length}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                REPO_MAP.md, {result.functionInventory.length} exported functions, {result.dependencyGraphLines.length} dependency
                lines, top {result.complexityRanking.length} complex files.
              </p>
              <button
                type="button"
                onClick={handleDownloadRepoMap}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition shrink-0"
              >
                <MapIcon className="w-3.5 h-3.5" />
                Download REPO_MAP.md
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto rounded border border-slate-800 p-2 text-[11px] font-mono text-slate-500 space-y-0.5">
              {result.complexityRanking.slice(0, 10).map((c) => (
                <div key={c.filePath}>
                  {c.filePath} — {c.lines} lines, score {c.complexityScore}
                </div>
              ))}
            </div>
          </Section>

          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                const jsonBlob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                downloadBlob(jsonBlob, 'analysis-report.json');
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download Full Report (JSON)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const RepoDuplicateAnalyzerPage = RepoDuplicateAnalyzer;

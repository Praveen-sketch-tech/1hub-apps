export { chatModule } from './chatActions';
import React, { useState } from 'react';
import { FileStack, Upload, Loader2, Check, X, Download, AlertTriangle, Sparkles } from 'lucide-react';
import { learnFromDocuments } from './services/analyzer';
import { scanForFill, generateFilledDocuments, type FillSession, type OutputFormat } from './services/fillEngine';
import { buildOutputZip } from './services/outputZip';
import { downloadBlob } from '@shared/utils/downloads';
import type { FieldGroup } from './types';

type Mode = 'learn' | 'fill';

function FileDropZone({
  files,
  onFilesChange,
  accept
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept: string;
}) {
  return (
    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-700 rounded-lg p-6 cursor-pointer hover:border-indigo-500 transition">
      <Upload className="w-6 h-6 text-slate-500" />
      <span className="text-sm text-slate-300 font-medium">
        {files.length > 0 ? `${files.length} file(s) selected` : 'Choose .docx, .xlsx, or fillable .pdf files'}
      </span>
      <span className="text-[11px] text-slate-500">Multiple files supported</span>
      <input
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => onFilesChange(Array.from(e.target.files || []))}
      />
    </label>
  );
}

export default function SmartBulkDocumentFiller() {
  const [mode, setMode] = useState<Mode>('learn');

  // Learn mode state
  const [learnFiles, setLearnFiles] = useState<File[]>([]);
  const [isLearning, setIsLearning] = useState(false);
  const [learnGroups, setLearnGroups] = useState<FieldGroup[]>([]);
  const [learnStatus, setLearnStatus] = useState('');

  // Fill mode state
  const [fillFiles, setFillFiles] = useState<File[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [session, setSession] = useState<FillSession | null>(null);
  const [formValues, setFormValues] = useState<Map<string, string>>(new Map());
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('original');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [fillStatus, setFillStatus] = useState('');

  const handleLearn = async () => {
    if (learnFiles.length === 0 || isLearning) return;
    setIsLearning(true);
    setLearnStatus('Analyzing documents...');
    try {
      const result = await learnFromDocuments(learnFiles);
      setLearnGroups(result.fieldGroups);
      setLearnStatus(
        `Analyzed ${learnFiles.length} document(s). Saved ${result.savedFieldCount} reusable field(s) to your profile.`
      );
    } catch (err) {
      setLearnStatus(`Error: ${err instanceof Error ? err.message : 'Analysis failed'}`);
    } finally {
      setIsLearning(false);
    }
  };

  const handleScan = async () => {
    if (fillFiles.length === 0 || isScanning) return;
    setIsScanning(true);
    setFillStatus('Scanning documents...');
    setGeneratedCount(0);
    try {
      const result = await scanForFill(fillFiles);
      setSession(result);
      const initial = new Map<string, string>();
      result.formFields.forEach((f) => initial.set(f.groupId, f.value));
      setFormValues(initial);
      setFillStatus(
        result.unsupportedFiles.length > 0
          ? `Scanned ${fillFiles.length} file(s). ${result.unsupportedFiles.length} file(s) couldn't be processed — see below.`
          : `Scanned ${fillFiles.length} file(s). Review the fields below, then Generate.`
      );
    } catch (err) {
      setFillStatus(`Error: ${err instanceof Error ? err.message : 'Scan failed'}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerate = async () => {
    if (!session || isGenerating) return;
    setIsGenerating(true);
    setFillStatus('Generating filled documents...');
    try {
      const generated = await generateFilledDocuments(session, formValues, outputFormat);
      if (generated.length === 0) {
        setFillStatus('No files could be generated — check the unsupported files list above.');
        return;
      }
      const zipBlob = await buildOutputZip(generated);
      const ok = downloadBlob(zipBlob, 'filled-documents.zip');
      setGeneratedCount(generated.length);
      setFillStatus(
        ok
          ? `Generated and downloaded ${generated.length} file(s) as filled-documents.zip.`
          : 'Files were generated but the download was blocked by the browser.'
      );
    } catch (err) {
      setFillStatus(`Error: ${err instanceof Error ? err.message : 'Generation failed'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-white p-4 font-sans space-y-4 overflow-y-auto">
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
        <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
          <FileStack className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base">Smart Bulk Document Filler</h1>
          <p className="text-xs text-slate-400">Learn repeated fields from filled docs, then auto-fill new ones</p>
        </div>
      </div>

      <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1">
        <button
          type="button"
          onClick={() => setMode('learn')}
          className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
            mode === 'learn' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          1. Learn
        </button>
        <button
          type="button"
          onClick={() => setMode('fill')}
          className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
            mode === 'fill' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          2. Fill &amp; Generate
        </button>
      </div>

      {mode === 'learn' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Upload documents you've already filled out (Word, Excel, or fillable PDF). We'll find values that repeat
            across them and save them as your reusable profile.
          </p>
          <FileDropZone files={learnFiles} onFilesChange={setLearnFiles} accept=".docx,.xlsx,.pdf" />
          <button
            type="button"
            onClick={handleLearn}
            disabled={learnFiles.length === 0 || isLearning}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition flex items-center justify-center gap-2"
          >
            {isLearning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isLearning ? 'Analyzing...' : 'Analyze & Learn'}
          </button>
          {learnStatus && <p className="text-xs text-slate-400">{learnStatus}</p>}

          {learnGroups.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 space-y-2">
              {learnGroups.map((g) => (
                <div key={g.id} className="flex items-center justify-between text-xs border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-slate-200 font-medium">{g.displayLabel}</p>
                    <p className="text-slate-500 font-mono">{g.occurrences.length} docs · {g.confidence}% agree</p>
                  </div>
                  {!g.varies && g.confidence >= 50 ? (
                    <span className="flex items-center gap-1 text-emerald-400 shrink-0">
                      <Check className="w-3.5 h-3.5" /> Saved: "{g.suggestedValue}"
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400 shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5" /> Varies per doc
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'fill' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Upload the documents you want filled. We'll pre-fill a form using your saved profile — review, edit, then
            generate all documents at once.
          </p>
          <FileDropZone files={fillFiles} onFilesChange={setFillFiles} accept=".docx,.xlsx,.pdf" />
          <button
            type="button"
            onClick={handleScan}
            disabled={fillFiles.length === 0 || isScanning}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition flex items-center justify-center gap-2"
          >
            {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isScanning ? 'Scanning...' : 'Scan Documents'}
          </button>

          {session && session.unsupportedFiles.length > 0 && (
            <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 space-y-1">
              {session.unsupportedFiles.map((f, i) => (
                <p key={i} className="text-[11px] text-amber-300">
                  <span className="font-mono">{f.fileName}</span>: {f.reason}
                </p>
              ))}
            </div>
          )}

          {session && session.formFields.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Review Fields</h2>
              {session.formFields.map((f) => (
                <div key={f.groupId}>
                  <label className="text-[11px] text-slate-500">{f.displayLabel}</label>
                  <input
                    value={formValues.get(f.groupId) ?? ''}
                    onChange={(e) => {
                      const next = new Map(formValues);
                      next.set(f.groupId, e.target.value);
                      setFormValues(next);
                    }}
                    className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              ))}

              <div className="pt-1">
                <label className="text-[11px] text-slate-500">Output format</label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setOutputFormat('original')}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${
                      outputFormat === 'original' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Original format
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutputFormat('pdf')}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${
                      outputFormat === 'pdf' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    PDF (Word docs only)
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Excel and PDF-form files always stay in their original format regardless of this choice.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isGenerating ? 'Generating...' : 'Generate & Download Zip'}
              </button>
            </div>
          )}

          {fillStatus && <p className="text-xs text-slate-400">{fillStatus}</p>}
          {generatedCount > 0 && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> {generatedCount} file(s) ready in filled-documents.zip
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export const SmartBulkDocumentFillerPage = SmartBulkDocumentFiller;

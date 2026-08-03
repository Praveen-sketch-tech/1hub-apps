export { chatModule } from "./chatActions";
import React, { useState } from 'react';
import { TextEditor } from './components/TextEditor';
import { Parser, ParsedFile } from './components/Parser';
import { Preview } from './components/Preview';
import { parsePromptText } from './services/parser';
import { validateParsedFiles } from './services/validator';
import { pushFilesToGitHub } from './services/github';
import { triggerDeployment } from './services/deployment';
import { autoFillBoilerplate, buildLocalPackageZip, detectAppSlug } from './services/generator';
import { downloadBlob } from '@shared/utils/downloads';
import { APP_REGISTRY } from '@core/apps/appRegistry';
import { Cpu, ChevronDown, ChevronRight } from 'lucide-react';

export default function AIAppImporter() {
  const [rawText, setRawText] = useState('');
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [isValid, setIsValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [detectedSlug, setDetectedSlug] = useState('');

  // GitHub push / Vercel deploy are entirely optional — nothing in this app
  // requires these credentials to parse, validate, or generate a local app
  // package. The panel is hidden by default and only matters for the
  // "Push & Deploy" button.
  const [showDeploySettings, setShowDeploySettings] = useState(false);
  const [ghToken, setGhToken] = useState(() => localStorage.getItem('ai_importer_gh_token') || '');
  const [ghOwner, setGhOwner] = useState(() => localStorage.getItem('ai_importer_gh_owner') || '');
  const [ghRepo, setGhRepo] = useState(() => localStorage.getItem('ai_importer_gh_repo') || '');
  const [deployWebhook, setDeployWebhook] = useState(() => localStorage.getItem('ai_importer_webhook') || '');

  const [deployStatus, setDeployStatus] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleParse = () => {
    const extracted = parsePromptText(rawText);
    const validated = validateParsedFiles(extracted, APP_REGISTRY);

    const list: ParsedFile[] = extracted.map((f) => ({
      path: f.path,
      content: f.content,
      status: validated.fileErrors[f.path] ? 'invalid' : 'valid',
      error: validated.fileErrors[f.path]
    }));

    setParsedFiles(list);
    setIsValid(validated.isValid);
    setValidationErrors(validated.errors);
    setDetectedSlug(extracted.length > 0 ? detectAppSlug(extracted) : '');
    setDeployStatus(`Parsed ${list.length} file${list.length === 1 ? '' : 's'} successfully.`);
  };

  const handleValidate = () => {
    const validated = validateParsedFiles(parsedFiles, APP_REGISTRY);
    setIsValid(validated.isValid);
    setValidationErrors(validated.errors);
    setDetectedSlug(parsedFiles.length > 0 ? detectAppSlug(parsedFiles) : '');
    setDeployStatus(validated.isValid ? 'Validation passed cleanly!' : 'Validation failed with issues.');
  };

  const handleUpdateFile = (index: number, newContent: string) => {
    const next = [...parsedFiles];
    next[index] = { ...next[index], content: newContent };
    setParsedFiles(next);
  };

  const handleDeleteFile = (index: number) => {
    const next = parsedFiles.filter((_, i) => i !== index);
    setParsedFiles(next);
  };

  const handleGenerateLocal = async () => {
    if (parsedFiles.length === 0) return;

    setIsGenerating(true);
    setDeployStatus('Auto-detecting app slug and manifest, and filling in any missing files...');

    try {
      const pkg = autoFillBoilerplate(parsedFiles);

      // Reflect every auto-created file (manifest, index, chatActions,
      // registry/loaders updates) back into the editable file list so the
      // person can see exactly what was generated.
      const existingPaths = new Set(parsedFiles.map((f) => f.path));
      const merged: ParsedFile[] = [
        ...parsedFiles,
        ...pkg.files
          .filter((f) => !existingPaths.has(f.path))
          .map((f) => ({ path: f.path, content: f.content, status: 'valid' as const }))
      ];
      setParsedFiles(merged);
      setDetectedSlug(pkg.appSlug);

      const zipBlob = await buildLocalPackageZip(pkg);
      const downloaded = downloadBlob(zipBlob, `${pkg.appSlug}-boilerplate.zip`);

      if (!downloaded) {
        setDeployStatus('Package was generated, but the browser blocked the download. Check your download settings and try again.');
      } else {
        setDeployStatus(
          `Generated complete boilerplate for "${pkg.appSlug}" (App #${pkg.manifest.number}) — ${pkg.files.length} files zipped and downloaded. ${pkg.notes.join(' ')}`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Local generation failed';
      setDeployStatus(`Generate Local Error: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePushGitHub = async () => {
    if (!ghToken || !ghOwner || !ghRepo) {
      alert('GitHub push is optional. If you want to use it, enter a GitHub Token, Owner, and Repo in the deployment settings below.');
      setShowDeploySettings(true);
      return;
    }

    localStorage.setItem('ai_importer_gh_token', ghToken);
    localStorage.setItem('ai_importer_gh_owner', ghOwner);
    localStorage.setItem('ai_importer_gh_repo', ghRepo);
    if (deployWebhook) localStorage.setItem('ai_importer_webhook', deployWebhook);

    setIsDeploying(true);
    setDeployStatus('Filling in missing files before pushing...');

    const pkg = autoFillBoilerplate(parsedFiles);

    setDeployStatus('Pushing changes to GitHub via REST API...');

    const result = await pushFilesToGitHub(
      { token: ghToken, owner: ghOwner, repo: ghRepo },
      pkg.files,
      pkg.manifest
    );

    if (!result.success) {
      setDeployStatus(`GitHub Push Error: ${result.error}`);
      setIsDeploying(false);
      return;
    }

    setDeployStatus(`Committed SHA: ${result.commitSha?.slice(0, 7)}. Triggering Vercel Deployment...`);

    const deployRes = await triggerDeployment({ webhookUrl: deployWebhook });
    setIsDeploying(false);

    if (deployRes.success) {
      setDeployStatus(
        deployWebhook
          ? 'Deployment triggered successfully!'
          : 'Pushed to GitHub. No deploy webhook was configured, so no remote deploy was triggered.'
      );
      if (deployRes.previewUrl) setPreviewUrl(deployRes.previewUrl);
    } else {
      setDeployStatus(`Deployment Trigger Failed: ${deployRes.error}`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-white p-4 font-sans space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base">AI App Importer (App Factory)</h1>
            <p className="text-xs text-slate-400">Parse LLM code output blocks to auto-generate a local app package, or optionally push & deploy</p>
          </div>
        </div>
        {detectedSlug && (
          <div className="text-xs font-mono px-3 py-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/30 text-indigo-300">
            Detected app: <span className="font-bold">{detectedSlug}</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDeploySettings((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800/60 transition"
        >
          <span className="flex items-center gap-2">
            {showDeploySettings ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Optional: GitHub Push &amp; Vercel Deploy settings
          </span>
          <span className="text-[10px] text-slate-500 font-normal">Not required for Parse, Validate, or Generate Local</span>
        </button>

        {showDeploySettings && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 pt-0 text-xs">
            <input
              type="password"
              placeholder="GitHub Token"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
              className="p-2 rounded bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="GitHub Owner (e.g., username)"
              value={ghOwner}
              onChange={(e) => setGhOwner(e.target.value)}
              className="p-2 rounded bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="GitHub Repo Name"
              value={ghRepo}
              onChange={(e) => setGhRepo(e.target.value)}
              className="p-2 rounded bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Vercel Deploy Webhook URL (Optional)"
              value={deployWebhook}
              onChange={(e) => setDeployWebhook(e.target.value)}
              className="p-2 rounded bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[420px]">
        <TextEditor value={rawText} onChange={setRawText} onParse={handleParse} />
        <Parser files={parsedFiles} onUpdateFile={handleUpdateFile} onDeleteFile={handleDeleteFile} />
      </div>

      <Preview
        files={parsedFiles}
        isValid={isValid}
        validationErrors={validationErrors}
        deployStatus={deployStatus}
        previewUrl={previewUrl}
        onValidate={handleValidate}
        onGenerate={handleGenerateLocal}
        onPushGitHub={handlePushGitHub}
        isDeploying={isDeploying}
        isGenerating={isGenerating}
      />
    </div>
  );
}

export const AIAppImporterPage = AIAppImporter;

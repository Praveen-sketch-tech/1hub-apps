export { chatModule } from "./chatActions";
import React, { useState } from 'react';
import { TextEditor } from './components/TextEditor';
import { Parser, ParsedFile } from './components/Parser';
import { Preview } from './components/Preview';
import { ApiCredentials } from './components/ApiCredentials';
import { AIGenerate } from './components/AIGenerate';
import { PipelineProgress } from './components/PipelineProgress';
import { parsePromptText } from './services/parser';
import { validateParsedFiles } from './services/validator';
import { pushFilesToGitHub } from './services/github';
import { triggerDeployment } from './services/deployment';
import { autoFillBoilerplate, buildLocalPackageZip, detectAppSlug } from './services/generator';
import { validateAIConnection, generateAppFilesFromPrompt } from './services/ai';
import { downloadBlob } from '@shared/utils/downloads';
import { APP_REGISTRY } from '@core/apps/appRegistry';
import { AIProvider, PipelineStep } from './types';
import { Cpu, ChevronDown, ChevronRight } from 'lucide-react';

// MODE 2 — GitHub Token stays a user-entered field, but Owner/Repo/Branch are
// now fixed for this deployment target instead of being editable UI fields.
const GITHUB_OWNER = 'Praveen-sketch-tech';
const GITHUB_REPO = '1hub-apps';
const GITHUB_BRANCH = 'main';

const PIPELINE_STEP_DEFS: { id: string; label: string }[] = [
  { id: 'generate-files', label: 'Generating Files...' },
  { id: 'update-registry', label: 'Updating Registry...' },
  { id: 'update-loaders', label: 'Updating App Loaders...' },
  { id: 'generate-chat-actions', label: 'Generating Chat Actions...' },
  { id: 'register-chat-module', label: 'Registering Chat Module...' },
  { id: 'github-push', label: 'GitHub Push...' },
  { id: 'waiting-vercel', label: 'Waiting for Vercel...' },
  { id: 'deployment-live', label: 'Deployment Live...' },
  { id: 'preview-ready', label: 'Preview Ready...' }
];

function freshPipelineSteps(): PipelineStep[] {
  return PIPELINE_STEP_DEFS.map((s) => ({ ...s, status: 'pending' as const }));
}

export default function AIAppImporter() {
  const [rawText, setRawText] = useState('');
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [isValid, setIsValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [detectedSlug, setDetectedSlug] = useState('');

  // GitHub push / Vercel deploy are entirely optional — nothing in this app
  // requires these credentials to parse, validate, or generate a local app
  // package. The panel is hidden by default and only matters for the
  // "Push & Deploy" button (MODE 2) and for the automated AI pipeline (MODE 3).
  // Owner/Repo/Branch are fixed for this deployment target (see constants
  // above) and are intentionally not editable fields anymore — only the
  // GitHub Token is entered by the user, and it is only ever stored in this
  // browser's localStorage.
  const [showDeploySettings, setShowDeploySettings] = useState(false);
  const [ghToken, setGhToken] = useState(() => localStorage.getItem('ai_importer_gh_token') || '');
  const [deployWebhook, setDeployWebhook] = useState(() => localStorage.getItem('ai_importer_webhook') || '');

  const [deployStatus, setDeployStatus] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // MODE 3 — AI Generation. Provider + key are only ever stored in this
  // browser's localStorage, exactly like the GitHub token above, and are
  // never sent anywhere except directly to the chosen provider's own API.
  const [aiProvider, setAiProvider] = useState<AIProvider>(
    () => (localStorage.getItem('ai_importer_ai_provider') as AIProvider) || 'openai'
  );
  const [aiApiKey, setAiApiKey] = useState(() => localStorage.getItem('ai_importer_ai_key') || '');
  const [aiConnected, setAiConnected] = useState(false);
  const [aiValidating, setAiValidating] = useState(false);
  const [aiConnectionError, setAiConnectionError] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(freshPipelineSteps());

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
      // registry/loaders/chat-module updates) back into the editable file
      // list so the person can see exactly what was generated.
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
    if (!ghToken) {
      alert('GitHub push is optional. If you want to use it, enter a GitHub Token in the deployment settings below.');
      setShowDeploySettings(true);
      return;
    }

    localStorage.setItem('ai_importer_gh_token', ghToken);
    if (deployWebhook) localStorage.setItem('ai_importer_webhook', deployWebhook);

    setIsDeploying(true);
    setDeployStatus('Filling in missing files before pushing...');

    const pkg = autoFillBoilerplate(parsedFiles);

    setDeployStatus('Pushing changes to GitHub via REST API...');

    const result = await pushFilesToGitHub(
      { token: ghToken, owner: GITHUB_OWNER, repo: GITHUB_REPO, branch: GITHUB_BRANCH },
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

  // ---------------------------------------------------------------------
  // MODE 3 — AI Generation
  // ---------------------------------------------------------------------

  const handleValidateConnection = async () => {
    setAiValidating(true);
    setAiConnectionError('');

    localStorage.setItem('ai_importer_ai_provider', aiProvider);
    localStorage.setItem('ai_importer_ai_key', aiApiKey);

    const result = await validateAIConnection({ provider: aiProvider, apiKey: aiApiKey });

    setAiConnected(result.success);
    setAiConnectionError(result.success ? '' : result.error || 'Connection failed.');
    setAiValidating(false);
  };

  const handleAIGenerate = async () => {
    if (!appDescription.trim() || isAIGenerating) return;

    setIsAIGenerating(true);
    setPreviewUrl('');
    let steps = freshPipelineSteps();
    setPipelineSteps(steps);

    const updateStep = (id: string, status: PipelineStep['status'], detail?: string) => {
      steps = steps.map((s) => (s.id === id ? { ...s, status, detail } : s));
      setPipelineSteps([...steps]);
    };

    const failActiveStep = (message: string) => {
      const activeIndex = steps.findIndex((s) => s.status === 'active');
      const idx = activeIndex !== -1 ? activeIndex : steps.findIndex((s) => s.status === 'pending');
      if (idx !== -1) {
        steps = steps.map((s, i) => (i === idx ? { ...s, status: 'error' as const, detail: message } : s));
        setPipelineSteps([...steps]);
      }
    };

    try {
      // Step 1 — call the configured LLM and feed its output straight into
      // the existing parser. No manual "Paste AI Output" / "Parse Files"
      // step is required.
      updateStep('generate-files', 'active');
      const rawOutput = await generateAppFilesFromPrompt({ provider: aiProvider, apiKey: aiApiKey }, appDescription);
      const extracted = parsePromptText(rawOutput);

      if (extracted.length === 0) {
        throw new Error('The AI response did not contain any recognizable FILE blocks.');
      }

      const validated = validateParsedFiles(extracted, APP_REGISTRY);
      const list: ParsedFile[] = extracted.map((f) => ({
        path: f.path,
        content: f.content,
        status: validated.fileErrors[f.path] ? 'invalid' : 'valid',
        error: validated.fileErrors[f.path]
      }));

      setRawText(rawOutput);
      setParsedFiles(list);
      setIsValid(validated.isValid);
      setValidationErrors(validated.errors);
      updateStep('generate-files', 'done', `${list.length} file(s) parsed`);

      // Steps 2–5 — autoFillBoilerplate performs the package generation,
      // registry update, loaders update, chatActions.ts scaffolding, and
      // chat module registration in one pass (same function MODE 1/2 use).
      updateStep('update-registry', 'active');
      const pkg = autoFillBoilerplate(extracted);
      setDetectedSlug(pkg.appSlug);
      updateStep('update-registry', 'done', pkg.registryUpdated ? 'Registry updated' : 'Already registered');

      updateStep('update-loaders', 'active');
      updateStep('update-loaders', 'done', pkg.loadersUpdated ? 'Loader added' : 'Already loaded');

      updateStep('generate-chat-actions', 'active');
      updateStep('generate-chat-actions', 'done');

      updateStep('register-chat-module', 'active');
      updateStep(
        'register-chat-module',
        'done',
        pkg.chatModuleRegistered ? 'Chat module registered' : 'Already registered'
      );

      // Reflect every auto-created file back into the editable file list.
      const existingPaths = new Set(extracted.map((f) => f.path));
      const merged: ParsedFile[] = [
        ...list,
        ...pkg.files
          .filter((f) => !existingPaths.has(f.path))
          .map((f) => ({ path: f.path, content: f.content, status: 'valid' as const }))
      ];
      setParsedFiles(merged);

      // Step 6 — GitHub push. Requires the same GitHub Token used by MODE 2;
      // owner/repo/branch are the fixed constants above.
      updateStep('github-push', 'active');
      if (!ghToken) {
        updateStep(
          'github-push',
          'error',
          'No GitHub Token entered — open "GitHub Push settings" above to push and deploy automatically.'
        );
        setDeployStatus(`App package for "${pkg.appSlug}" generated locally. Add a GitHub Token to push and deploy automatically.`);
        return;
      }

      localStorage.setItem('ai_importer_gh_token', ghToken);
      if (deployWebhook) localStorage.setItem('ai_importer_webhook', deployWebhook);

      const pushResult = await pushFilesToGitHub(
        { token: ghToken, owner: GITHUB_OWNER, repo: GITHUB_REPO, branch: GITHUB_BRANCH },
        pkg.files,
        pkg.manifest
      );

      if (!pushResult.success) {
        updateStep('github-push', 'error', pushResult.error);
        setDeployStatus(`GitHub Push Error: ${pushResult.error}`);
        return;
      }
      updateStep('github-push', 'done', `Commit ${pushResult.commitSha?.slice(0, 7)}`);

      // Step 7 — trigger the Vercel deploy hook, if configured.
      updateStep('waiting-vercel', 'active');
      const deployRes = await triggerDeployment({ webhookUrl: deployWebhook });

      if (!deployRes.success) {
        updateStep('waiting-vercel', 'error', deployRes.error);
        setDeployStatus(`Deployment Trigger Failed: ${deployRes.error}`);
        return;
      }
      updateStep('waiting-vercel', 'done', deployWebhook ? 'Deploy hook triggered' : 'No webhook configured');

      // Step 8 — mark deployment as live once the hook call succeeded.
      updateStep('deployment-live', 'done', deployWebhook ? 'Live' : 'Skipped (no webhook)');

      // Step 9 — surface the preview URL, if the deploy hook returned one.
      updateStep('preview-ready', 'active');
      if (deployRes.previewUrl) {
        setPreviewUrl(deployRes.previewUrl);
        updateStep('preview-ready', 'done');
        setDeployStatus(`"${pkg.appSlug}" generated, pushed, and deployed successfully!`);
      } else {
        updateStep('preview-ready', 'done', 'No preview URL returned — configure a Vercel deploy webhook for one.');
        setDeployStatus(`"${pkg.appSlug}" generated and pushed to GitHub. Configure a deploy webhook for automatic Vercel deploys.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI generation failed';
      failActiveStep(message);
      setDeployStatus(`AI Generate Error: ${message}`);
    } finally {
      setIsAIGenerating(false);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 pt-0 text-xs">
            <input
              type="password"
              placeholder="GitHub Token"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
              className="p-2 rounded bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Vercel Deploy Webhook URL (Optional)"
              value={deployWebhook}
              onChange={(e) => setDeployWebhook(e.target.value)}
              className="p-2 rounded bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500"
            />
            <p className="md:col-span-2 text-[10px] text-slate-500 font-mono">
              Pushes to {GITHUB_OWNER}/{GITHUB_REPO} on branch "{GITHUB_BRANCH}". Token is stored only in this browser's local storage.
            </p>
          </div>
        )}
      </div>

      <ApiCredentials
        provider={aiProvider}
        apiKey={aiApiKey}
        connected={aiConnected}
        validating={aiValidating}
        error={aiConnectionError}
        onProviderChange={(p) => {
          setAiProvider(p);
          setAiConnected(false);
        }}
        onApiKeyChange={(key) => {
          setAiApiKey(key);
          setAiConnected(false);
        }}
        onValidate={handleValidateConnection}
      />

      {aiConnected && (
        <>
          <AIGenerate
            description={appDescription}
            onDescriptionChange={setAppDescription}
            onGenerate={handleAIGenerate}
            isGenerating={isAIGenerating}
          />
          <PipelineProgress steps={pipelineSteps} />
        </>
      )}

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

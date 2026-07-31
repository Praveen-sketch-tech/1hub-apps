import React, { useState } from 'react';
import { TextEditor } from './components/TextEditor';
import { Parser, ParsedFile } from './components/Parser';
import { Preview } from './components/Preview';
import { parsePromptText } from './services/parser';
import { validateParsedFiles } from './services/validator';
import { pushFilesToGitHub } from './services/github';
import { triggerDeployment } from './services/deployment';
import { Cpu } from 'lucide-react';

export default function AIAppImporter() {
  const [rawText, setRawText] = useState('');
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [isValid, setIsValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const [ghToken, setGhToken] = useState(localStorage.getItem('ai_importer_gh_token') || '');
  const [ghOwner, setGhOwner] = useState(localStorage.getItem('ai_importer_gh_owner') || '');
  const [ghRepo, setGhRepo] = useState(localStorage.getItem('ai_importer_gh_repo') || '');
  const [deployWebhook, setDeployWebhook] = useState(localStorage.getItem('ai_importer_webhook') || '');

  const [deployStatus, setDeployStatus] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  const handleParse = () => {
    const extracted = parsePromptText(rawText);
    const validated = validateParsedFiles(extracted);

    const list: ParsedFile[] = extracted.map((f) => ({
      path: f.path,
      content: f.content,
      status: validated.fileErrors[f.path] ? 'invalid' : 'valid',
      error: validated.fileErrors[f.path]
    }));

    setParsedFiles(list);
    setIsValid(validated.isValid);
    setValidationErrors(validated.errors);
    setDeployStatus(`Parsed ${list.length} files successfully.`);
  };

  const handleValidate = () => {
    const validated = validateParsedFiles(parsedFiles);
    setIsValid(validated.isValid);
    setValidationErrors(validated.errors);
    setDeployStatus(validated.isValid ? 'Validation passed cleanly!' : 'Validation failed with issues.');
  };

  const handleUpdateFile = (index: number, newContent: string) => {
    const next = [...parsedFiles];
    next[index].content = newContent;
    setParsedFiles(next);
  };

  const handleDeleteFile = (index: number) => {
    const next = parsedFiles.filter((_, i) => i !== index);
    setParsedFiles(next);
  };

  const handleGenerateLocal = () => {
    setDeployStatus('Files verified and ready for local build inclusion.');
  };

  const handlePushGitHub = async () => {
    if (!ghToken || !ghOwner || !ghRepo) {
      alert('Please enter GitHub Token, Owner, and Repo in configuration.');
      return;
    }

    localStorage.setItem('ai_importer_gh_token', ghToken);
    localStorage.setItem('ai_importer_gh_owner', ghOwner);
    localStorage.setItem('ai_importer_gh_repo', ghRepo);
    if (deployWebhook) localStorage.setItem('ai_importer_webhook', deployWebhook);

    setIsDeploying(true);
    setDeployStatus('Pushing changes to GitHub via REST API...');

    const result = await pushFilesToGitHub(
      { token: ghToken, owner: ghOwner, repo: ghRepo },
      parsedFiles
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
      setDeployStatus('Deployment triggered successfully!');
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
            <p className="text-xs text-slate-400">Parse LLM code output blocks to auto-generate & deploy apps</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs">
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
      />
    </div>
  );
}

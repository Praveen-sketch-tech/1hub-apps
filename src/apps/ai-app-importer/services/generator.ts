import { ParsedFileItem, ParsedFile, AppManifest } from '../types';

export function autoFillBoilerplate(files: (ParsedFileItem | ParsedFile)[]): { files: ParsedFileItem[]; manifest: AppManifest } {
  const updatedFiles: ParsedFileItem[] = files.map((f) => ({ path: f.path, content: f.content }));

  let appSlug = 'new-ai-app';
  const firstAppFile = files.find((f) => f.path.startsWith('src/apps/'));
  if (firstAppFile) {
    const parts = firstAppFile.path.split('/');
    if (parts.length >= 3) {
      appSlug = parts[2];
    }
  }

  const appDir = `src/apps/${appSlug}`;

  let manifestFile = updatedFiles.find((f) => f.path.endsWith('manifest.json'));
  let manifest: AppManifest;

  if (manifestFile) {
    try {
      manifest = JSON.parse(manifestFile.content);
    } catch {
      manifest = {
        id: appSlug,
        number: '035',
        name: appSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        description: 'Auto-generated app via AI App Factory v2',
        path: `/apps/${appSlug}`
      };
    }
  } else {
    manifest = {
      id: appSlug,
      number: '035',
      name: appSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: 'Auto-generated app via AI App Factory v2',
      path: `/apps/${appSlug}`
    };
    manifestFile = {
      path: `${appDir}/manifest.json`,
      content: JSON.stringify(manifest, null, 2)
    };
    updatedFiles.push(manifestFile);
  }

  const indexFile = updatedFiles.find((f) => f.path.endsWith(`${appSlug}/index.tsx`));
  if (!indexFile) {
    const componentName = manifest.name.replace(/[^a-zA-Z0-9]/g, '');
    const defaultIndex = `import React from 'react';

export default function ${componentName || 'App'}() {
  return (
    <div className="p-6 bg-slate-950 text-white min-h-screen font-sans">
      <h1 className="text-xl font-bold">${manifest.name}</h1>
      <p className="text-slate-400 text-sm mt-2">${manifest.description}</p>
    </div>
  );
}
`;
    updatedFiles.push({ path: `${appDir}/index.tsx`, content: defaultIndex });
  }

  const chatActionsFile = updatedFiles.find((f) => f.path.endsWith('chatActions.ts'));
  if (!chatActionsFile) {
    const defaultChatActions = `export const chatActions = [];\n`;
    updatedFiles.push({ path: `${appDir}/chatActions.ts`, content: defaultChatActions });
  }

  return { files: updatedFiles, manifest };
}

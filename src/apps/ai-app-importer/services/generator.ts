import { ParsedFileItem, ParsedFile, AppManifest } from '../types';
import { APP_REGISTRY } from '@core/apps/appRegistry';
import appRegistrySource from '@core/apps/appRegistry.ts?raw';
import appLoadersSource from '@core/apps/appLoaders.ts?raw';

export interface GeneratedPackage {
  /** Every file that should be written to disk, including auto-created ones. */
  files: ParsedFileItem[];
  manifest: AppManifest;
  appSlug: string;
  /** True if an updated src/core/apps/appRegistry.ts was included in `files`. */
  registryUpdated: boolean;
  /** True if an updated src/core/apps/appLoaders.ts was included in `files`. */
  loadersUpdated: boolean;
  /** Human-readable summary of what was auto-created/auto-registered. */
  notes: string[];
}

function toPascalCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function toTitleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Finds the next free App # by scanning the live registry, so nothing is hardcoded. */
function nextAvailableAppNumber(): string {
  const numbers = APP_REGISTRY.map((app) => parseInt(app.number, 10)).filter((n) => !Number.isNaN(n));
  const highest = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(highest + 1).padStart(3, '0');
}

/** Detects the app slug from any parsed file living under src/apps/<slug>/... */
export function detectAppSlug(files: (ParsedFileItem | ParsedFile)[]): string {
  const appFile = files.find((f) => /^src\/apps\/([^/]+)\//.test(f.path));
  if (appFile) {
    const match = appFile.path.match(/^src\/apps\/([^/]+)\//);
    if (match) return match[1];
  }
  return `ai-generated-app-${Date.now().toString(36)}`;
}

/**
 * Takes whatever files were parsed from the pasted AI output and returns a
 * complete, buildable app package: missing manifest/index/chat-action files
 * are created automatically, and the shared app registry + lazy loaders are
 * updated automatically if the app slug isn't registered yet.
 *
 * Nothing here requires a GitHub token, Vercel project, or any other
 * credential — this operates entirely on the files already in memory plus
 * the registry bundled with this build.
 */
export function autoFillBoilerplate(files: (ParsedFileItem | ParsedFile)[]): GeneratedPackage {
  const updatedFiles: ParsedFileItem[] = files.map((f) => ({ path: f.path, content: f.content }));
  const notes: string[] = [];

  const appSlug = detectAppSlug(updatedFiles);
  const appDir = `src/apps/${appSlug}`;
  const componentName = toPascalCase(appSlug) || 'App';
  const pageExportName = `${componentName}Page`;
  const existingEntry = APP_REGISTRY.find((app) => app.id === appSlug);

  const manifestFile = updatedFiles.find((f) => f.path.endsWith('manifest.json'));
  let manifest: AppManifest;

  const buildDefaultManifest = (): AppManifest => ({
    id: appSlug,
    number: existingEntry ? existingEntry.number : nextAvailableAppNumber(),
    name: toTitleCase(appSlug),
    description: 'Auto-generated app imported via AI App Importer.',
    path: `/apps/${appSlug}`
  });

  if (manifestFile) {
    try {
      const parsed = JSON.parse(manifestFile.content) as Partial<AppManifest>;
      manifest = {
        id: parsed.id || appSlug,
        number: parsed.number || (existingEntry ? existingEntry.number : nextAvailableAppNumber()),
        name: parsed.name || toTitleCase(appSlug),
        description: parsed.description || 'Auto-generated app imported via AI App Importer.',
        path: parsed.path || `/apps/${appSlug}`,
        icon: parsed.icon,
        category: parsed.category
      };
      manifestFile.content = JSON.stringify(manifest, null, 2);
    } catch {
      manifest = buildDefaultManifest();
      manifestFile.content = JSON.stringify(manifest, null, 2);
      notes.push('manifest.json contained invalid JSON — it was regenerated with detected defaults.');
    }
  } else {
    manifest = buildDefaultManifest();
    updatedFiles.push({ path: `${appDir}/manifest.json`, content: JSON.stringify(manifest, null, 2) });
    notes.push(`Created missing manifest.json for "${appSlug}" (App #${manifest.number}).`);
  }

  const hasIndex = updatedFiles.some((f) => f.path === `${appDir}/index.tsx` || f.path === `${appDir}/index.ts`);
  if (!hasIndex) {
    const defaultIndex = `import React from 'react';

export default function ${componentName}() {
  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-white p-6 font-sans">
      <h1 className="text-xl font-bold">${manifest.name}</h1>
      <p className="text-slate-400 text-sm mt-2">${manifest.description}</p>
    </div>
  );
}

export const ${pageExportName} = ${componentName};
`;
    updatedFiles.push({ path: `${appDir}/index.tsx`, content: defaultIndex });
    notes.push(`Created missing ${appDir}/index.tsx with a default component and "${pageExportName}" export.`);
  } else {
    const indexFile = updatedFiles.find((f) => f.path === `${appDir}/index.tsx` || f.path === `${appDir}/index.ts`);
    if (indexFile && !indexFile.content.includes(pageExportName) && !indexFile.content.includes('export default')) {
      notes.push(`Warning: ${indexFile.path} does not export "${pageExportName}" or a default export — the app loader may fail to resolve a component.`);
    }
  }

  const hasChatActions = updatedFiles.some((f) => f.path === `${appDir}/chatActions.ts`);
  if (!hasChatActions) {
    const chatScaffold = `import type { AppChatModule } from '@core/chat/types';

// Keep processing in reusable lib functions and call the same functions from the UI + chat.
export const chatModule: AppChatModule = {
  appId: '${appSlug}',
  actions: [
    // Add chat-accessible app actions here.
  ],
};
`;
    updatedFiles.push({ path: `${appDir}/chatActions.ts`, content: chatScaffold });
    notes.push(`Created optional ${appDir}/chatActions.ts scaffold (no chat actions registered yet).`);
  }

  let registryUpdated = false;
  let loadersUpdated = false;

  const alreadyInRegistry = appRegistrySource.includes(`id: "${appSlug}"`) || appRegistrySource.includes(`id: '${appSlug}'`);
  if (!alreadyInRegistry) {
    const entry = `  {\n    id: "${manifest.id}",\n    number: "${manifest.number}",\n    name: ${JSON.stringify(manifest.name)},\n    description: ${JSON.stringify(manifest.description)},\n    path: "${manifest.path}",\n    tags: [],\n  },\n`;
    const lastBracket = appRegistrySource.lastIndexOf(']');
    if (lastBracket !== -1) {
      const updatedRegistry = appRegistrySource.slice(0, lastBracket) + entry + appRegistrySource.slice(lastBracket);
      updatedFiles.push({ path: 'src/core/apps/appRegistry.ts', content: updatedRegistry });
      registryUpdated = true;
      notes.push(`Auto-registered "${appSlug}" in src/core/apps/appRegistry.ts as App #${manifest.number}.`);
    }
  } else {
    notes.push(`"${appSlug}" is already present in src/core/apps/appRegistry.ts — left unchanged.`);
  }

  const alreadyLoaded = appLoadersSource.includes(`@apps/${appSlug}`);
  if (!alreadyLoaded) {
    const loaderEntry = `  {\n    path: "${manifest.path}",\n    name: ${JSON.stringify(manifest.name)},\n    component: lazy(() =>\n      import("@apps/${appSlug}").then((module) => ({\n        default: module.${pageExportName} || module.default,\n      }))\n    ),\n  },\n`;
    const lastBracket = appLoadersSource.lastIndexOf(']');
    if (lastBracket !== -1) {
      const updatedLoaders = appLoadersSource.slice(0, lastBracket) + loaderEntry + appLoadersSource.slice(lastBracket);
      updatedFiles.push({ path: 'src/core/apps/appLoaders.ts', content: updatedLoaders });
      loadersUpdated = true;
      notes.push(`Auto-registered a lazy route for "${appSlug}" in src/core/apps/appLoaders.ts.`);
    }
  } else {
    notes.push(`A loader for "${appSlug}" already exists in src/core/apps/appLoaders.ts — left unchanged.`);
  }

  return { files: updatedFiles, manifest, appSlug, registryUpdated, loadersUpdated, notes };
}

function buildInstallReadme(pkg: GeneratedPackage): string {
  const registryLine = pkg.registryUpdated
    ? 'Replace src/core/apps/appRegistry.ts with the copy included in this zip (or merge the new entry by hand).'
    : 'This app was already present in appRegistry.ts, so no updated registry file is included.';

  const loadersLine = pkg.loadersUpdated
    ? 'Replace src/core/apps/appLoaders.ts with the copy included in this zip (or merge the new lazy route by hand).'
    : 'This app already had a loader registered, so no updated loaders file is included.';

  return `# ${pkg.manifest.name} — generated by AI App Importer

App slug: ${pkg.appSlug}
App number: ${pkg.manifest.number}
Route: ${pkg.manifest.path}

## Install into your 1Hub Apps repo

1. Extract this zip into the root of your project so files merge into "src/apps/${pkg.appSlug}/".
2. ${registryLine}
3. ${loadersLine}
4. Run "npm run build" to confirm everything compiles.

No GitHub token, Vercel token, or webhook is required for this local package — those are
only needed if you use the optional "Push & Deploy" button instead.

## What was auto-generated
${pkg.notes.map((note) => `- ${note}`).join('\n')}
`;
}

/**
 * Packages a generated app (plus any auto-created files) into a downloadable
 * zip that mirrors the real repo layout, so "Generate Local" produces a
 * complete, ready-to-extract boilerplate instead of only a status message.
 */
export async function buildLocalPackageZip(pkg: GeneratedPackage): Promise<Blob> {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const zip = new JSZip();

  pkg.files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  zip.file('AI_APP_IMPORTER_INSTALL.md', buildInstallReadme(pkg));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

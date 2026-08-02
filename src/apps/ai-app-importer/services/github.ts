import { ParsedFileItem, ParsedFile, AppManifest, GitHubConfig, GitHubResult } from '../types';

export async function pushFilesToGitHub(
  config: GitHubConfig,
  files: (ParsedFileItem | ParsedFile)[],
  manifest?: AppManifest,
  commitMessage = 'feat: auto-deploy new app via AI App Importer'
): Promise<GitHubResult> {
  const { token, owner, repo, branch = 'main' } = config;

  try {
    const headers = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
    if (!refRes.ok) throw new Error(`Failed to fetch branch ref: ${refRes.statusText}`);
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, { headers });
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    const allFilesToPush: ParsedFileItem[] = files.map((f) => ({ path: f.path, content: f.content }));

    if (manifest) {
      try {
        const regRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/src/core/apps/appRegistry.ts?ref=${branch}`, { headers });
        if (regRes.ok) {
          const regData = await regRes.json();
          const regContent = atob(regData.content.replace(/\n/g, ''));
          if (!regContent.includes(manifest.id)) {
            const regEntry = `  {\n    id: "${manifest.id}",\n    number: "${manifest.number}",\n    name: "${manifest.name}",\n    description: "${manifest.description}",\n    path: "${manifest.path}",\n    tags: []\n  }`;
            const lastBracket = regContent.lastIndexOf(']');
            if (lastBracket !== -1) {
              const before = regContent.slice(0, lastBracket).trimEnd();
              const needsComma = !before.endsWith(',') && !before.endsWith('[');
              const updatedReg = before + (needsComma ? ',\n' : '\n') + regEntry + '\n' + regContent.slice(lastBracket);
              allFilesToPush.push({ path: 'src/core/apps/appRegistry.ts', content: updatedReg });
            }
          }
        }

        const loaderRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/src/core/apps/appLoaders.ts?ref=${branch}`, { headers });
        if (loaderRes.ok) {
          const loaderData = await loaderRes.json();
          const loaderContent = atob(loaderData.content.replace(/\n/g, ''));
          if (!loaderContent.includes(manifest.id)) {
            const componentName = manifest.name.replace(/[^a-zA-Z0-9]/g, '');
            const loaderEntry = `  {\n    path: "${manifest.path}",\n    name: "${manifest.name}",\n    component: lazy(() =>\n      import("@apps/${manifest.id}").then((module) => ({\n        default: module.default || module.${componentName}Page,\n      }))\n    ),\n  }`;
            const lastBracket = loaderContent.lastIndexOf(']');
            if (lastBracket !== -1) {
              const before = loaderContent.slice(0, lastBracket).trimEnd();
              const needsComma = !before.endsWith(',') && !before.endsWith('[');
              const updatedLoader = before + (needsComma ? ',\n' : '\n') + loaderEntry + '\n' + loaderContent.slice(lastBracket);
              allFilesToPush.push({ path: 'src/core/apps/appLoaders.ts', content: updatedLoader });
            }
          }
        }
      } catch (err) {
        console.warn('Core registry auto-update on remote skipped:', err);
      }
    }

    const treeItems = allFilesToPush.map((file) => ({
      path: file.path,
      mode: '100644',
      type: 'blob',
      content: file.content
    }));

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
    });
    if (!treeRes.ok) throw new Error(`Failed to create tree: ${treeRes.statusText}`);
    const treeData = await treeRes.json();

    const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: commitMessage, tree: treeData.sha, parents: [latestCommitSha] })
    });
    if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${newCommitRes.statusText}`);
    const newCommitData = await newCommitRes.json();

    const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sha: newCommitData.sha, force: false })
    });
    if (!updateRefRes.ok) throw new Error(`Failed to update branch ref: ${updateRefRes.statusText}`);

    return { success: true, commitSha: newCommitData.sha };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GitHub push failed';
    return { success: false, error: message };
  }
}

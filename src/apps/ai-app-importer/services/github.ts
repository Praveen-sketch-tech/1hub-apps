import { ParsedFileItem } from './parser';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}

export async function pushFilesToGitHub(
  config: GitHubConfig,
  files: ParsedFileItem[],
  commitMessage = 'feat: import app via AI App Importer'
): Promise<{ success: boolean; commitSha?: string; error?: string }> {
  const { token, owner, repo, branch = 'main' } = config;

  try {
    const headers = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    const refRes = await fetch(`[https://api.github.com/repos/$](https://api.github.com/repos/$){owner}/${repo}/git/ref/heads/${branch}`, { headers });
    if (!refRes.ok) throw new Error(`Failed to fetch branch ref: ${refRes.statusText}`);
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    const commitRes = await fetch(`[https://api.github.com/repos/$](https://api.github.com/repos/$){owner}/${repo}/git/commits/${latestCommitSha}`, { headers });
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    const treeItems = files.map((file) => ({
      path: file.path,
      mode: '100644',
      type: 'blob',
      content: file.content
    }));

    const treeRes = await fetch(`[https://api.github.com/repos/$](https://api.github.com/repos/$){owner}/${repo}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems
      })
    });
    if (!treeRes.ok) throw new Error(`Failed to create tree: ${treeRes.statusText}`);
    const treeData = await treeRes.json();

    const newCommitRes = await fetch(`[https://api.github.com/repos/$](https://api.github.com/repos/$){owner}/${repo}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: commitMessage,
        tree: treeData.sha,
        parents: [latestCommitSha]
      })
    });
    if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${newCommitRes.statusText}`);
    const newCommitData = await newCommitRes.json();

    const updateRefRes = await fetch(`[https://api.github.com/repos/$](https://api.github.com/repos/$){owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommitData.sha,
        force: false
      })
    });
    if (!updateRefRes.ok) throw new Error(`Failed to update branch ref: ${updateRefRes.statusText}`);

    return { success: true, commitSha: newCommitData.sha };
  } catch (err: any) {
    return { success: false, error: err.message || 'GitHub push failed' };
  }
}

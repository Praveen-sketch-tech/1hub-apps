import { DestinationPlan, RepoInfo } from '../types'
import { fileToBase64, textFileToUtf8Base64 } from './fileReading'
import { isBinaryPath } from './project'

const API_BASE = 'https://api.github.com'

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function githubFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...headers(token),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return `${res.status} — ${data.message || res.statusText}`
  } catch {
    return `${res.status} — ${res.statusText || 'GitHub API request failed'}`
  }
}

export class GitHubApiError extends Error {}

// ---------------------------------------------------------------------------
// Token validation + repo listing
// ---------------------------------------------------------------------------

export async function validateToken(token: string): Promise<{ username: string }> {
  const res = await githubFetch(`${API_BASE}/user`, token)
  if (!res.ok) throw new GitHubApiError(await parseErrorMessage(res))
  const data = await res.json()
  return { username: data.login }
}

export async function listRepositories(token: string): Promise<RepoInfo[]> {
  const perPage = 100
  const maxPages = 5 // up to 500 repos, generous for a personal/organization account
  const repos: RepoInfo[] = []

  for (let page = 1; page <= maxPages; page++) {
    const res = await githubFetch(
      `${API_BASE}/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
      token,
    )
    if (!res.ok) throw new GitHubApiError(await parseErrorMessage(res))
    const data: any[] = await res.json()

    for (const repo of data) {
      repos.push({
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch,
        private: repo.private,
      })
    }

    if (data.length < perPage) break
  }

  return repos
}

export async function listBranches(token: string, owner: string, repo: string): Promise<string[]> {
  const res = await githubFetch(`${API_BASE}/repos/${owner}/${repo}/branches?per_page=100`, token)
  if (!res.ok) throw new GitHubApiError(await parseErrorMessage(res))
  const data: any[] = await res.json()
  return data.map((b) => b.name)
}

// ---------------------------------------------------------------------------
// Destination existence check
// ---------------------------------------------------------------------------

export async function checkDestinationExists(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<boolean> {
  const res = await githubFetch(
    `${API_BASE}/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(branch)}`,
    token,
  )
  if (res.status === 404) return false
  if (!res.ok) throw new GitHubApiError(await parseErrorMessage(res))
  return true
}

function encodeGitHubPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

// ---------------------------------------------------------------------------
// Atomic publish: create blobs for every file, build one tree on top of the
// branch's current tree, create a single commit, then fast-forward the
// branch ref. This never touches files outside the destination paths and
// never creates a separate commit per file.
// ---------------------------------------------------------------------------

export interface PublishProgressCallbacks {
  onBlobsStart?: (total: number) => void
  onBlobUploaded?: (done: number, total: number) => void
}

export async function publishToGitHub(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  plan: DestinationPlan,
  commitMessage: string,
  callbacks: PublishProgressCallbacks = {},
): Promise<{ commitSha: string }> {
  // 1. Resolve the branch head commit and its base tree.
  const refRes = await githubFetch(`${API_BASE}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, token)
  if (!refRes.ok) throw new GitHubApiError(await parseErrorMessage(refRes))
  const refData = await refRes.json()
  const latestCommitSha: string = refData.object.sha

  const commitRes = await githubFetch(`${API_BASE}/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, token)
  if (!commitRes.ok) throw new GitHubApiError(await parseErrorMessage(commitRes))
  const commitData = await commitRes.json()
  const baseTreeSha: string = commitData.tree.sha

  // 2. Create a blob for every file (base64, binary-safe either way).
  callbacks.onBlobsStart?.(plan.entries.length)
  let done = 0

  const blobShas = await Promise.all(
    plan.entries.map(async (entry) => {
      const base64 = isBinaryPath(entry.repoPath)
        ? await fileToBase64(entry.sourceFile)
        : await textFileToUtf8Base64(entry.sourceFile)

      const blobRes = await githubFetch(`${API_BASE}/repos/${owner}/${repo}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({ content: base64, encoding: 'base64' }),
      })
      if (!blobRes.ok) throw new GitHubApiError(`Failed to upload ${entry.repoPath}: ${await parseErrorMessage(blobRes)}`)
      const blobData = await blobRes.json()

      done += 1
      callbacks.onBlobUploaded?.(done, plan.entries.length)

      return { path: entry.repoPath, sha: blobData.sha as string }
    }),
  )

  // 3. Build the tree on top of the branch's current tree.
  const treeItems = blobShas.map(({ path, sha }) => ({
    path,
    mode: '100644',
    type: 'blob',
    sha,
  }))

  const treeRes = await githubFetch(`${API_BASE}/repos/${owner}/${repo}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  })
  if (!treeRes.ok) throw new GitHubApiError(await parseErrorMessage(treeRes))
  const treeData = await treeRes.json()

  // 4. Create a single commit for the whole publish.
  const newCommitRes = await githubFetch(`${API_BASE}/repos/${owner}/${repo}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({ message: commitMessage, tree: treeData.sha, parents: [latestCommitSha] }),
  })
  if (!newCommitRes.ok) throw new GitHubApiError(await parseErrorMessage(newCommitRes))
  const newCommitData = await newCommitRes.json()

  // 5. Fast-forward the branch ref to the new commit.
  const updateRefRes = await githubFetch(
    `${API_BASE}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
    token,
    { method: 'PATCH', body: JSON.stringify({ sha: newCommitData.sha, force: false }) },
  )
  if (!updateRefRes.ok) throw new GitHubApiError(await parseErrorMessage(updateRefRes))

  return { commitSha: newCommitData.sha }
}

// ---------------------------------------------------------------------------
// Deployment readiness polling (same-origin fetch against the live URL).
// ---------------------------------------------------------------------------

export async function pollUntilLive(
  liveUrl: string,
  { timeoutMs = 45000, intervalMs = 3000 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const res = await fetch(liveUrl, { method: 'GET', cache: 'no-store' })
      if (res.ok) return true
    } catch {
      // Network hiccup during deploy — keep polling until the timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return false
}

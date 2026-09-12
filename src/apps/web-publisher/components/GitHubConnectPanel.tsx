import { useState } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { RepoInfo } from '../types'

interface GitHubConnectPanelProps {
  connected: boolean
  connecting: boolean
  username: string | null
  error: string | null
  repos: RepoInfo[]
  selectedRepoFullName: string
  branches: string[]
  selectedBranch: string
  branchesLoading: boolean
  onConnect: (token: string) => void
  onDisconnect: () => void
  onSelectRepo: (fullName: string) => void
  onSelectBranch: (branch: string) => void
}

export function GitHubConnectPanel({
  connected,
  connecting,
  username,
  error,
  repos,
  selectedRepoFullName,
  branches,
  selectedBranch,
  branchesLoading,
  onConnect,
  onDisconnect,
  onSelectRepo,
  onSelectBranch,
}: GitHubConnectPanelProps) {
  const [tokenInput, setTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)

  return (
    <Card className="tool-card">
      <div className="tool-stack">
        <h2 className="wp-section-title">GitHub</h2>

        {!connected && (
          <>
            <div className="tool-field">
              <label className="tool-label" htmlFor="wp-token">Personal Access Token</label>
              <div className="wp-token-row">
                <input
                  id="wp-token"
                  className="tool-input"
                  type={showToken ? 'text' : 'password'}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button type="button" variant="secondary" onClick={() => setShowToken((v) => !v)}>
                  {showToken ? 'Hide' : 'Show'}
                </Button>
              </div>
              <p className="wp-hint">
                ⚠️ Your token is stored only in this browser's local storage. It is sent only directly to
                GitHub's API, never to any other server, and is never written into published files or commits.
              </p>
            </div>

            <div className="tool-actions">
              <Button
                type="button"
                onClick={() => onConnect(tokenInput.trim())}
                disabled={!tokenInput.trim() || connecting}
                loading={connecting}
              >
                Connect to GitHub
              </Button>
            </div>

            {error && <p className="wp-error">{error}</p>}
          </>
        )}

        {connected && (
          <>
            <div className="wp-connection-status">
              <span className="wp-status-dot" aria-hidden="true" />
              <span>Connected as <strong>{username}</strong></span>
              <Button type="button" variant="secondary" onClick={onDisconnect}>
                Disconnect
              </Button>
            </div>

            <div className="tool-field">
              <label className="tool-label" htmlFor="wp-repo">Repository</label>
              <select
                id="wp-repo"
                className="tool-select"
                value={selectedRepoFullName}
                onChange={(e) => onSelectRepo(e.target.value)}
              >
                <option value="">Select a repository…</option>
                {repos.map((repo) => (
                  <option key={repo.fullName} value={repo.fullName}>
                    {repo.fullName}{repo.private ? ' (private)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedRepoFullName && (
              <div className="tool-field">
                <label className="tool-label" htmlFor="wp-branch">Branch</label>
                <select
                  id="wp-branch"
                  className="tool-select"
                  value={selectedBranch}
                  onChange={(e) => onSelectBranch(e.target.value)}
                  disabled={branchesLoading}
                >
                  {branchesLoading && <option value="">Loading branches…</option>}
                  {!branchesLoading &&
                    branches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                </select>
              </div>
            )}

            {error && <p className="wp-error">{error}</p>}
          </>
        )}
      </div>
    </Card>
  )
}

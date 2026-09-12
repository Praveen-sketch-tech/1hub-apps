import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { getAppNumber } from '@core/apps/appRegistry'
import { UploadedFile, RepoInfo, PublishStageId, PublishStageState } from './types'
import {
  detectDuplicatePaths,
  detectHtmlEntry,
  detectOversizedFiles,
  detectProjectType,
  detectServerSideFiles,
  findBrokenLocalReferences,
  planDestination,
  validateSlug,
} from './lib/project'
import {
  GitHubApiError,
  checkDestinationExists,
  listBranches,
  listRepositories,
  pollUntilLive,
  publishToGitHub,
  validateToken,
} from './lib/github'
import { GitHubConnectPanel } from './components/GitHubConnectPanel'
import { UploadPanel } from './components/UploadPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { PublishSettingsPanel } from './components/PublishSettingsPanel'
import { ProgressPanel } from './components/ProgressPanel'
import './web-publisher.css'

const TOKEN_STORAGE_KEY = 'web_publisher_gh_token'

const STAGE_LABELS: Record<PublishStageId, string> = {
  preparing: 'Preparing files',
  validating: 'Validating project',
  'checking-github': 'Checking GitHub',
  uploading: 'Uploading files',
  committing: 'Creating commit',
  'waiting-deploy': 'Waiting for deployment',
  live: 'Live',
}

function initialStages(): PublishStageState[] {
  return (Object.keys(STAGE_LABELS) as PublishStageId[]).map((id) => ({
    id,
    label: STAGE_LABELS[id],
    status: 'pending',
  }))
}

export function WebPublisherPage() {
  // --- GitHub connection state -------------------------------------------
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [username, setUsername] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [repos, setRepos] = useState<RepoInfo[]>([])
  const [selectedRepoFullName, setSelectedRepoFullName] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [branchesLoading, setBranchesLoading] = useState(false)

  // --- Upload / project state ---------------------------------------------
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [selectedEntryOverride, setSelectedEntryOverride] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])

  // --- Destination check ---------------------------------------------------
  const [destinationExists, setDestinationExists] = useState<boolean | null>(null)
  const [checkingDestination, setCheckingDestination] = useState(false)
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)

  // --- Publish flow ----------------------------------------------------------
  const [stages, setStages] = useState<PublishStageState[]>(initialStages())
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [commitSha, setCommitSha] = useState<string | null>(null)
  const [deploymentConfirmed, setDeploymentConfirmed] = useState(false)
  const [retryingDeployCheck, setRetryingDeployCheck] = useState(false)

  // Reconnect automatically if a token was already stored from a previous visit.
  useEffect(() => {
    if (!token || username) return
    let cancelled = false
    setConnecting(true)
    validateToken(token)
      .then(({ username: name }) => {
        if (!cancelled) setUsername(name)
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_STORAGE_KEY)
          setToken(null)
        }
      })
      .finally(() => {
        if (!cancelled) setConnecting(false)
      })
    return () => { cancelled = true }
  }, [token, username])

  useEffect(() => {
    if (!token || !username) return
    listRepositories(token)
      .then(setRepos)
      .catch((err) => setConnectError(err instanceof Error ? err.message : 'Failed to load repositories.'))
  }, [token, username])

  useEffect(() => {
    if (!token || !selectedRepoFullName) {
      setBranches([])
      return
    }
    const [owner, repo] = selectedRepoFullName.split('/')
    setBranchesLoading(true)
    listBranches(token, owner, repo)
      .then((names) => {
        setBranches(names)
        const repoInfo = repos.find((r) => r.fullName === selectedRepoFullName)
        setSelectedBranch(repoInfo?.defaultBranch && names.includes(repoInfo.defaultBranch) ? repoInfo.defaultBranch : names[0] || '')
      })
      .catch((err) => setConnectError(err instanceof Error ? err.message : 'Failed to load branches.'))
      .finally(() => setBranchesLoading(false))
  }, [token, selectedRepoFullName, repos])

  function handleConnect(inputToken: string) {
    setConnectError(null)
    setConnecting(true)
    validateToken(inputToken)
      .then(({ username: name }) => {
        localStorage.setItem(TOKEN_STORAGE_KEY, inputToken)
        setToken(inputToken)
        setUsername(name)
      })
      .catch((err) => setConnectError(err instanceof Error ? err.message : 'Could not connect to GitHub.'))
      .finally(() => setConnecting(false))
  }

  function handleDisconnect() {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUsername(null)
    setRepos([])
    setSelectedRepoFullName('')
    setBranches([])
    setSelectedBranch('')
  }

  // --- Project detection ----------------------------------------------------
  const projectType = files.length > 0 ? detectProjectType(files) : null
  const entryDetection = useMemo(() => detectHtmlEntry(files), [files])
  const effectiveEntry = selectedEntryOverride ?? entryDetection.entryPath

  const destination = useMemo(() => {
    if (files.length === 0 || !effectiveEntry) return null
    const slugResult = validateSlug(slug)
    if (!slugResult.valid) return null
    return planDestination(files, slugResult.normalized, effectiveEntry)
  }, [files, effectiveEntry, slug])

  const slugValidation = validateSlug(slug)

  function handleFilesSelected(newFiles: UploadedFile[]) {
    setFiles(newFiles)
    setSelectedEntryOverride(null)
    setDestinationExists(null)
    setReplaceConfirmed(false)
    setCommitSha(null)
    setPublishError(null)
    setStages(initialStages())

    const serverFiles = detectServerSideFiles(newFiles)
    const oversized = detectOversizedFiles(newFiles)
    const duplicates = detectDuplicatePaths(newFiles)
    const nextWarnings: string[] = []

    if (serverFiles.length > 0) {
      nextWarnings.push(
        `Web Publisher supports static HTML/CSS/JS websites. Server-side applications cannot run directly through this publisher. Unsupported: ${serverFiles.join(', ')}`,
      )
    }
    if (oversized.length > 0) {
      nextWarnings.push(`File exceeds GitHub size limit: ${oversized.map((o) => o.path).join(', ')}`)
    }
    if (duplicates.length > 0) {
      nextWarnings.push(`Duplicate file paths detected: ${duplicates.join(', ')}`)
    }

    setWarnings(nextWarnings)

    findBrokenLocalReferences(newFiles).then((refWarnings) => {
      if (refWarnings.length > 0) {
        setWarnings((prev) => [...prev, ...refWarnings])
      }
    })
  }

  function handleClearFiles() {
    setFiles([])
    setSelectedEntryOverride(null)
    setWarnings([])
    setDestinationExists(null)
    setReplaceConfirmed(false)
    setCommitSha(null)
    setPublishError(null)
    setStages(initialStages())
  }

  // --- Destination existence check ------------------------------------------
  useEffect(() => {
    setDestinationExists(null)
    setReplaceConfirmed(false)

    if (!token || !selectedRepoFullName || !selectedBranch || !destination) return

    const [owner, repo] = selectedRepoFullName.split('/')
    let cancelled = false
    setCheckingDestination(true)

    checkDestinationExists(token, owner, repo, selectedBranch, destination.basePath)
      .then((exists) => {
        if (!cancelled) setDestinationExists(exists)
      })
      .catch((err) => {
        if (!cancelled) setPublishError(err instanceof Error ? err.message : 'Could not check destination.')
      })
      .finally(() => {
        if (!cancelled) setCheckingDestination(false)
      })

    return () => { cancelled = true }
  }, [token, selectedRepoFullName, selectedBranch, destination])

  function updateStage(id: PublishStageId, status: PublishStageState['status'], detail?: string) {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, status, detail } : s)))
  }

  const canPublish =
    Boolean(token && username) &&
    Boolean(selectedRepoFullName && selectedBranch) &&
    files.length > 0 &&
    slugValidation.valid &&
    Boolean(effectiveEntry) &&
    Boolean(destination) &&
    (destinationExists !== true || replaceConfirmed) &&
    !publishing

  const handlePublish = useCallback(async () => {
    if (!token || !destination || !selectedRepoFullName || !selectedBranch) return
    const [owner, repo] = selectedRepoFullName.split('/')

    setPublishing(true)
    setPublishError(null)
    setCommitSha(null)
    setDeploymentConfirmed(false)
    setStages(initialStages())

    try {
      updateStage('preparing', 'active')
      // Files are already read into memory as File handles; nothing to stage on disk.
      updateStage('preparing', 'done')

      updateStage('validating', 'active')
      if (!effectiveEntry) throw new Error('No HTML entry file detected.')
      if (!slugValidation.valid) throw new Error(slugValidation.error || 'Invalid URL name.')
      updateStage('validating', 'done')

      updateStage('checking-github', 'active')
      const stillExists = await checkDestinationExists(token, owner, repo, selectedBranch, destination.basePath)
      if (stillExists && !replaceConfirmed) {
        updateStage('checking-github', 'error', 'Destination already exists')
        throw new Error('This URL already exists. Confirm replace before publishing.')
      }
      updateStage('checking-github', 'done')

      updateStage('uploading', 'active')
      const { commitSha: sha } = await publishToGitHub(
        token,
        owner,
        repo,
        selectedBranch,
        destination,
        `Publish ${slugValidation.normalized} via Web Publisher`,
        {
          onBlobUploaded: (done, total) => updateStage('uploading', 'active', `${done}/${total} files`),
        },
      )
      updateStage('uploading', 'done')
      updateStage('committing', 'done', sha.slice(0, 10))
      setCommitSha(sha)

      updateStage('waiting-deploy', 'active')
      const live = await pollUntilLive(destination.liveUrl)
      if (live) {
        updateStage('waiting-deploy', 'done')
        updateStage('live', 'done')
        setDeploymentConfirmed(true)
      } else {
        updateStage('waiting-deploy', 'error', 'Still processing')
      }
    } catch (err) {
      const message = err instanceof GitHubApiError || err instanceof Error ? err.message : 'Publish failed.'
      setPublishError(message)
      setStages((prev) => prev.map((s) => (s.status === 'active' ? { ...s, status: 'error' } : s)))
    } finally {
      setPublishing(false)
    }
  }, [token, destination, selectedRepoFullName, selectedBranch, effectiveEntry, slugValidation, replaceConfirmed])

  async function handleRetryDeployCheck() {
    if (!destination) return
    setRetryingDeployCheck(true)
    try {
      const live = await pollUntilLive(destination.liveUrl, { timeoutMs: 8000, intervalMs: 2000 })
      if (live) {
        setDeploymentConfirmed(true)
        updateStage('waiting-deploy', 'done')
        updateStage('live', 'done')
      }
    } finally {
      setRetryingDeployCheck(false)
    }
  }

  return (
    <div className="tool-page">
      <PageContainer>
        <ToolAppHeader
          appNumber={getAppNumber('web-publisher')}
          title="🌐 Web Publisher"
          description="Upload → Preview → Publish → Live. Publish static HTML/CSS/JS websites straight to GitHub from your browser."
        />

        <div className="tool-stack">
          <GitHubConnectPanel
            connected={Boolean(token && username)}
            connecting={connecting}
            username={username}
            error={connectError}
            repos={repos}
            selectedRepoFullName={selectedRepoFullName}
            branches={branches}
            selectedBranch={selectedBranch}
            branchesLoading={branchesLoading}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onSelectRepo={(fullName) => { setSelectedRepoFullName(fullName); setSelectedBranch('') }}
            onSelectBranch={setSelectedBranch}
          />

          <UploadPanel files={files} onFilesSelected={handleFilesSelected} onClear={handleClearFiles} />

          {files.length > 0 && <PreviewPanel files={files} entryPath={effectiveEntry} />}

          {files.length > 0 && (
            <PublishSettingsPanel
              slug={slug}
              onSlugChange={setSlug}
              slugError={slug.length > 0 ? slugValidation.error ?? null : null}
              projectType={projectType}
              htmlFiles={entryDetection.htmlFiles}
              needsEntrySelection={entryDetection.needsSelection}
              selectedEntry={selectedEntryOverride}
              onSelectEntry={setSelectedEntryOverride}
              destination={destination}
              warnings={warnings}
              destinationExists={destinationExists}
              checkingDestination={checkingDestination}
              replaceConfirmed={replaceConfirmed}
              onConfirmReplace={() => setReplaceConfirmed(true)}
              onCancelReplace={() => setReplaceConfirmed(false)}
            />
          )}

          {files.length > 0 && (
            <div className="tool-actions">
              <button
                type="button"
                className="tool-button tool-button-primary"
                disabled={!canPublish}
                onClick={handlePublish}
              >
                {publishing ? 'Publishing…' : '🚀 Publish Website'}
              </button>
              {!token && <span className="tool-muted">Connect to GitHub first.</span>}
            </div>
          )}

          {(publishing || commitSha || publishError) && (
            <ProgressPanel
              stages={stages}
              errorMessage={publishError}
              commitSha={commitSha}
              liveUrl={destination?.liveUrl ?? null}
              deploymentConfirmed={deploymentConfirmed}
              onRetryDeployCheck={handleRetryDeployCheck}
              retryingDeployCheck={retryingDeployCheck}
            />
          )}
        </div>
      </PageContainer>
    </div>
  )
}

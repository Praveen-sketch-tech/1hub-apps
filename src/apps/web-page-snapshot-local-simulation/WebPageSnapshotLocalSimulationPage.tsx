import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import {
  createPreviewBlobUrl,
  createSimulationTarget,
  createSnapshotProject,
  detectSnapshotCapabilities,
  exportSnapshotProject,
  fetchAccessibleHtml,
  parsePageMap,
  parseSnapshotProject,
  revokePreviewBlobUrl,
} from './lib/snapshotEngine'
import {
  deleteSnapshotProject,
  listSnapshotProjects,
  loadSnapshotProject,
  saveSnapshotProject,
} from './lib/snapshotStorage'
import { saveProjectToOpfs } from './lib/opfs'
import type { SnapshotPageMap, SnapshotProject, SnapshotProjectSummary } from './types/snapshot'
import './WebPageSnapshotLocalSimulation.css'

const SAMPLE_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sample Image Tool</title>
  <style>
    body { font-family: system-ui; margin: 0; background: #f5f7fb; color: #172033; }
    main { max-width: 760px; margin: 40px auto; background: white; padding: 28px; border-radius: 18px; }
    label { display:block; margin:16px 0 6px; }
    input, button { padding: 10px 12px; }
    button { margin-top:18px; }
  </style>
</head>
<body>
  <main>
    <h1>Smart Image Compressor</h1>
    <p>Upload an image, choose quality and process it locally.</p>
    <label>Image</label><input type="file">
    <label>Quality</label><input type="range" min="1" max="100" value="80">
    <button>Compress Image</button>
  </main>
</body>
</html>`

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function WebPageSnapshotLocalSimulationPage() {
  const [sourceUrl, setSourceUrl] = useState('')
  const [html, setHtml] = useState(SAMPLE_HTML)
  const [pageMapText, setPageMapText] = useState('')
  const [project, setProject] = useState<SnapshotProject | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState('Ready. Build a local snapshot from supplied HTML or a Page Map.')
  const [saved, setSaved] = useState<SnapshotProjectSummary[]>([])
  const [busy, setBusy] = useState(false)

  const capabilities = useMemo(() => detectSnapshotCapabilities(), [])

  const refreshSaved = async () => {
    if (!capabilities.indexedDb) return
    try {
      setSaved(await listSnapshotProjects())
    } catch {
      setSaved([])
    }
  }

  useEffect(() => {
    void refreshSaved()
  }, [])

  useEffect(() => {
    if (!project) {
      setPreviewUrl((previous) => {
        revokePreviewBlobUrl(previous)
        return null
      })
      return
    }

    const next = createPreviewBlobUrl(project)
    setPreviewUrl((previous) => {
      revokePreviewBlobUrl(previous)
      return next
    })

    return () => revokePreviewBlobUrl(next)
  }, [project])

  const buildFromHtml = () => {
    const next = createSnapshotProject({
      name: 'Local HTML Snapshot',
      html,
      sourceUrl,
      title: 'Local HTML Snapshot',
      accessMode: 'user-html',
    })
    setProject(next)
    setStatus(`Snapshot created locally. ${next.warnings.length ? `${next.warnings.length} sanitization warning(s).` : 'No sanitization warnings.'}`)
  }

  const buildFromPageMap = () => {
    try {
      const map = parsePageMap(pageMapText)
      const next = createSnapshotProject({
        name: map.title ? `${map.title} Simulation` : 'Page Map Simulation',
        pageMap: map,
        sourceUrl: map.sourceUrl || map.url || sourceUrl,
        title: map.title,
        accessMode: 'page-map',
      })
      setProject(next)
      setStatus('Local simulation generated from structured Page Map / Feature Map JSON.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not parse Page Map JSON.')
    }
  }

  const tryAccessibleUrl = async () => {
    if (!sourceUrl.trim()) {
      setStatus('Enter a URL first.')
      return
    }

    setBusy(true)
    setStatus('Checking whether this browser is allowed to fetch the HTML directly…')
    const result = await fetchAccessibleHtml(sourceUrl.trim())
    setBusy(false)

    if (!result.ok || !result.html) {
      setStatus(`${result.message} Fallback: ${result.fallbackMode}.`)
      return
    }

    setHtml(result.html)
    const next = createSnapshotProject({
      name: 'Accessible URL Snapshot',
      html: result.html,
      sourceUrl: result.finalUrl || sourceUrl,
      accessMode: 'accessible-html',
    })
    setProject(next)
    setStatus(result.message)
  }

  const handleHtmlFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') {
      setStatus('Please choose an HTML or HTM file.')
      return
    }
    const text = await file.text()
    setHtml(text)
    setProject(
      createSnapshotProject({
        name: file.name.replace(/\.html?$/i, ''),
        html: text,
        sourceUrl,
        accessMode: 'html-file',
      }),
    )
    setStatus(`Loaded ${file.name} locally.`)
  }

  const handleJsonFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      if (/snapshot-project/i.test(file.name)) {
        const imported = parseSnapshotProject(text)
        setProject(imported)
        setStatus(`Imported snapshot project ${imported.name}.`)
      } else {
        const map = parsePageMap(text)
        setPageMapText(JSON.stringify(map, null, 2))
        setStatus('Loaded Page Map JSON. Click "Build from Page Map" to create a local simulation.')
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not import JSON.')
    }
  }

  const saveLocal = async () => {
    if (!project) return
    try {
      await saveSnapshotProject(project)
      setStatus('Snapshot project saved in browser-local IndexedDB.')
      await refreshSaved()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save snapshot project.')
    }
  }

  const saveOpfs = async () => {
    if (!project) return
    try {
      const fileName = await saveProjectToOpfs(project)
      setStatus(`Snapshot project saved to browser OPFS as ${fileName}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save to OPFS.')
    }
  }

  const loadSaved = async (id: string) => {
    try {
      const loaded = await loadSnapshotProject(id)
      if (!loaded) {
        setStatus('Saved snapshot project was not found.')
        return
      }
      setProject(loaded)
      setHtml(loaded.sanitizedHtml)
      setPageMapText(loaded.pageMap ? JSON.stringify(loaded.pageMap, null, 2) : '')
      setSourceUrl(loaded.metadata.sourceUrl || '')
      setStatus(`Loaded ${loaded.name} from browser-local storage.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load snapshot project.')
    }
  }

  const removeSaved = async (id: string) => {
    await deleteSnapshotProject(id)
    await refreshSaved()
    setStatus('Saved snapshot deleted.')
  }

  const exportProject = () => {
    if (!project) return
    downloadBlob(
      exportSnapshotProject(project),
      `${project.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'snapshot'}-snapshot-project.json`,
    )
  }

  const target = project ? createSimulationTarget(project) : null

  return (
    <div className="snapshot-page">
      <ToolAppHeader
        appNumber="022"
        title="Web Page Snapshot & Local Simulation"
        description="Create temporary browser-local page snapshots and simulation targets from legitimately accessible HTML, user-provided source, or structured Page Maps."
      />

      <section className="snapshot-notice">
        <strong>Browser security stays intact.</strong>
        <span>
          This tool does not bypass CORS, authentication, paywalls, or protected content. Direct URL import only works when the target explicitly allows browser access.
        </span>
      </section>

      <section className="snapshot-grid snapshot-grid--top">
        <div className="snapshot-card">
          <h2>1. Source</h2>
          <label>
            Original source URL / metadata
            <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://example.com/tool" />
          </label>
          <div className="snapshot-row">
            <button type="button" onClick={tryAccessibleUrl} disabled={busy}>
              {busy ? 'Checking…' : 'Try accessible URL import'}
            </button>
            <label className="snapshot-file-button">
              Load HTML file
              <input type="file" accept=".html,.htm,text/html" onChange={handleHtmlFile} />
            </label>
          </div>
          <label>
            HTML / page source
            <textarea rows={14} value={html} onChange={(e) => setHtml(e.target.value)} />
          </label>
          <button type="button" onClick={buildFromHtml}>Build local snapshot</button>
        </div>

        <div className="snapshot-card">
          <h2>2. App #021 Page Map input</h2>
          <p className="snapshot-muted">
            Paste or load structured Page Map / Feature Map JSON. The adapter creates a local simulation shell without pretending to clone inaccessible resources.
          </p>
          <label className="snapshot-file-button snapshot-file-button--inline">
            Load JSON
            <input type="file" accept=".json,application/json" onChange={handleJsonFile} />
          </label>
          <textarea
            rows={17}
            value={pageMapText}
            onChange={(e) => setPageMapText(e.target.value)}
            placeholder='{"title":"My Tool","inputs":[{"label":"Width"}],"buttons":["Process"],"downloadControls":["Download"]}'
          />
          <button type="button" onClick={buildFromPageMap} disabled={!pageMapText.trim()}>
            Build from Page Map
          </button>
        </div>
      </section>

      <section className="snapshot-status">{status}</section>

      <section className="snapshot-grid">
        <div className="snapshot-card snapshot-card--preview">
          <div className="snapshot-card-header">
            <div>
              <h2>3. Local snapshot preview</h2>
              <p className="snapshot-muted">Rendered from a Blob URL using sanitized local HTML.</p>
            </div>
            <span className="snapshot-pill">{project ? project.metadata.accessMode : 'no project'}</span>
          </div>
          {previewUrl ? (
            <iframe
              className="snapshot-frame"
              src={previewUrl}
              title="Local snapshot preview"
              sandbox="allow-forms allow-same-origin"
            />
          ) : (
            <div className="snapshot-empty">Create or import a snapshot project to preview it.</div>
          )}
        </div>

        <div className="snapshot-card">
          <h2>4. Reusable simulation target</h2>
          <p className="snapshot-muted">
            Future App #020 adapters can consume this app-owned target descriptor and resolve actions against the local snapshot context. App #022 does not duplicate the interaction engine.
          </p>
          <pre className="snapshot-code">{JSON.stringify(target ? {
            projectId: target.projectId,
            kind: target.kind,
            sourceUrl: target.sourceUrl,
            hasPageMap: !!target.pageMap,
            htmlLength: target.html.length,
          } : null, null, 2)}</pre>

          <h3>Capabilities</h3>
          <div className="snapshot-capabilities">
            <span>IndexedDB: {capabilities.indexedDb ? 'Yes' : 'No'}</span>
            <span>Blob URL: {capabilities.blobUrl ? 'Yes' : 'No'}</span>
            <span>OPFS: {capabilities.opfs ? 'Yes' : 'No'}</span>
          </div>

          <div className="snapshot-row snapshot-row--wrap">
            <button type="button" onClick={saveLocal} disabled={!project || !capabilities.indexedDb}>Save locally</button>
            <button type="button" onClick={exportProject} disabled={!project}>Export project JSON</button>
            <button type="button" onClick={saveOpfs} disabled={!project || !capabilities.opfs}>Save to OPFS</button>
          </div>

          {project?.warnings.length ? (
            <>
              <h3>Sanitization notes</h3>
              <ul>{project.warnings.slice(0, 8).map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </>
          ) : null}
        </div>
      </section>

      <section className="snapshot-card">
        <h2>5. Saved local snapshot projects</h2>
        {!saved.length ? (
          <p className="snapshot-muted">No IndexedDB projects saved yet.</p>
        ) : (
          <div className="snapshot-saved-list">
            {saved.map((item) => (
              <div className="snapshot-saved-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <div className="snapshot-muted">{item.sourceUrl || 'No source URL'} · {item.accessMode}</div>
                </div>
                <div className="snapshot-row">
                  <button type="button" onClick={() => loadSaved(item.id)}>Load</button>
                  <button type="button" className="snapshot-button-danger" onClick={() => void removeSaved(item.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

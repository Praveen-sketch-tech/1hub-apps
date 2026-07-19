import { useEffect, useMemo, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { ensureDemoWorkflowWiringLoaded } from '@core/apps/demoWorkflowWiring'
import {
  createFinalDemoWorkflow,
  extractFinalVideoResult,
  getFinalDemoOrchestratorAdapter,
  runFinalDemoWorkflow,
} from './lib/orchestratorBridge'
import type { DemoWorkflowState, DemoWorkflowStrategy } from './types/finalDemo'
import './AutomaticWebsiteDemoVideoGenerator.css'

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function AutomaticWebsiteDemoVideoGeneratorPage() {
  const [url, setUrl] = useState('https://example.com')
  const [strategy, setStrategy] = useState<DemoWorkflowStrategy | ''>('')
  const [state, setState] = useState<DemoWorkflowState>(() =>
    createFinalDemoWorkflow('https://example.com'),
  )
  const [status, setStatus] = useState('Ready. Enter a URL and start the final demo-video workflow.')
  const [busy, setBusy] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const [wiringReady, setWiringReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ensureDemoWorkflowWiringLoaded().then(() => {
      if (!cancelled) setWiringReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const adapterAvailable = wiringReady && !!getFinalDemoOrchestratorAdapter()
  const finalVideo = useMemo(() => extractFinalVideoResult(state), [state])

  useEffect(() => {
    if (!finalVideo) {
      setVideoUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous)
        return null
      })
      return
    }

    const next = URL.createObjectURL(finalVideo.blob)
    setVideoUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return next
    })

    return () => URL.revokeObjectURL(next)
  }, [finalVideo])

  const prepare = () => {
    const next = createFinalDemoWorkflow(
      url.trim(),
      strategy || undefined,
    )
    setState(next)
    setStatus('Prepared final demo workflow.')
  }

  const generate = async () => {
    if (!url.trim()) {
      setStatus('Enter a website/app URL first.')
      return
    }

    setBusy(true)
    try {
      await ensureDemoWorkflowWiringLoaded()
      setWiringReady(true)
      const prepared = createFinalDemoWorkflow(url.trim(), strategy || undefined)
      setState(prepared)
      const result = await runFinalDemoWorkflow(prepared, setState)
      setState(result.state)

      if (result.completed) {
        setStatus('Demo workflow completed. Final video output is ready if the processing stage returned one.')
      } else if (result.waitingForUser) {
        setStatus('Workflow paused at a truthful checkpoint. User permission/input or a missing reusable adapter is required.')
      } else {
        setStatus('Workflow stopped before completion.')
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Demo workflow failed.')
    } finally {
      setBusy(false)
    }
  }

  const retry = async () => {
    setBusy(true)
    try {
      const result = await runFinalDemoWorkflow(state, setState)
      setState(result.state)
      setStatus(
        result.completed
          ? 'Workflow completed after retry.'
          : result.waitingForUser
            ? 'Retry reached a user/adapter checkpoint.'
            : 'Retry stopped before completion.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tool-page final-demo-page">
      <ToolAppHeader
        appNumber="027"
        title="Automatic Website Demo Video Generator"
        description="Turn a website/app URL into a reusable automated demo-video workflow by orchestrating the existing 1 Hub Apps analysis, simulation, capture and video-processing modules."
      />

      <section className="final-demo-hero">
        <h2>Paste URL → Generate Demo Video</h2>
        <div className="final-demo-form">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/app"
          />
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as DemoWorkflowStrategy | '')}
          >
            <option value="">Auto strategy</option>
            <option value="direct-accessible">Direct / accessible</option>
            <option value="snapshot-local-simulation">Snapshot / local simulation</option>
            <option value="visual-capture-fallback">Visual capture fallback</option>
          </select>
          <button type="button" onClick={generate} disabled={busy}>
            {busy ? 'Generating…' : 'Generate Demo Video'}
          </button>
        </div>
        {!adapterAvailable ? (
          <p className="final-demo-warning">
            App #026 orchestrator adapter is not registered in this runtime yet. The final UI remains honest and will pause instead of pretending the pipeline executed.
          </p>
        ) : null}
      </section>

      <section className="final-demo-status">{status}</section>

      <section className="final-demo-grid">
        <div className="final-demo-card">
          <div className="final-demo-header">
            <div>
              <h2>Workflow progress</h2>
              <p className="final-demo-muted">
                Status: {state.status} · Strategy: {state.strategy || 'not chosen yet'}
              </p>
            </div>
            <div className="final-demo-actions">
              <button type="button" onClick={prepare}>Reset plan</button>
              <button type="button" onClick={retry} disabled={busy}>Retry / continue</button>
            </div>
          </div>

          <div className="final-demo-stages">
            {state.stages.map((stage, index) => (
              <article className={`final-demo-stage final-demo-stage--${stage.status}`} key={stage.id}>
                <div className="final-demo-index">{index + 1}</div>
                <div>
                  <strong>{stage.label}</strong>
                  <div className="final-demo-muted">{stage.status} · attempts {stage.attempts}</div>
                  {stage.message ? <p>{stage.message}</p> : null}
                  {stage.error ? <p className="final-demo-error">{stage.error}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="final-demo-card">
          <h2>Final video</h2>
          {videoUrl && finalVideo ? (
            <>
              <video className="final-demo-video" controls src={videoUrl} />
              <button
                type="button"
                onClick={() => downloadBlob(finalVideo.blob, finalVideo.fileName)}
              >
                Download final demo video
              </button>
            </>
          ) : (
            <div className="final-demo-empty">
              Final processed video will appear here after App #026 completes the capture and App #019 processing stages.
            </div>
          )}
        </div>
      </section>

      <section className="final-demo-card">
        <h2>Reusable module chain</h2>
        <div className="final-demo-pipeline">
          <span>#021 Analyze</span><b>→</b>
          <span>#022 Snapshot</span><b>→</b>
          <span>#023 Flow</span><b>→</b>
          <span>#024 Assets</span><b>→</b>
          <span>#020 Simulate</span><b>→</b>
          <span>#018/#025 Capture</span><b>→</b>
          <span>#019 Process</span><b>→</b>
          <span>#026 Orchestrate</span><b>→</b>
          <span>#027 Final UX</span>
        </div>

        {state.warnings.length ? (
          <>
            <h3>Workflow notes</h3>
            <ul>{state.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </>
        ) : null}
      </section>
    </div>
  )
}

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { ensureDemoWorkflowWiringLoaded } from '@core/apps/demoWorkflowWiring'
import { listRegisteredWorkflowAdapters } from './lib/adapterRegistry'
import {
  createDemoWorkflowJob,
  createInitialWorkflowState,
  exportWorkflowState,
  parseWorkflowState,
  runDemoWorkflow,
} from './lib/orchestrator'
import type { DemoWorkflowState, DemoWorkflowStrategy } from './types/workflow'
import './AutomatedDemoWorkflowOrchestrator.css'

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function AutomatedDemoWorkflowOrchestratorPage() {
  const [url, setUrl] = useState('https://example.com')
  const [strategy, setStrategy] = useState<DemoWorkflowStrategy | ''>('')
  const [state, setState] = useState<DemoWorkflowState>(() =>
    createInitialWorkflowState(createDemoWorkflowJob({ url: 'https://example.com' })),
  )
  const [status, setStatus] = useState('Ready. Build a workflow plan or run registered reusable stage adapters.')
  const [busy, setBusy] = useState(false)

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

  const registered = useMemo(() => listRegisteredWorkflowAdapters(), [state.updatedAt, wiringReady])

  const build = () => {
    const job = createDemoWorkflowJob({
      url: url.trim() || undefined,
      preferredStrategy: strategy || undefined,
      maxRetries: 1,
    })
    const next = createInitialWorkflowState(job)
    setState(next)
    setStatus('Created a new structured workflow plan.')
  }

  const run = async () => {
    setBusy(true)
    try {
      const result = await runDemoWorkflow(state, {
        stopBeforePermissionStage: true,
        onUpdate: setState,
      })
      setState(result.state)
      if (result.waitingForUser) {
        setStatus('Workflow paused safely: a reusable adapter or explicit user permission/input is required.')
      } else if (result.completed) {
        setStatus('Workflow completed through registered reusable adapters.')
      } else {
        setStatus('Workflow stopped because a stage failed.')
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Workflow execution failed.')
    } finally {
      setBusy(false)
    }
  }

  const importState = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const next = parseWorkflowState(await file.text())
      setState(next)
      setUrl(next.job.url || '')
      setStrategy(next.strategy || next.job.preferredStrategy || '')
      setStatus(`Imported workflow state from ${file.name}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not import workflow state.')
    }
  }

  return (
    <div className="orchestrator-page">
      <ToolAppHeader
        appNumber="026"
        title="Automated Demo Workflow Orchestrator"
        description="Coordinate reusable analysis, snapshot, flow, asset, simulation, capture and video-processing capabilities into one browser-first demo workflow."
      />

      <section className="orchestrator-notice">
        <strong>Orchestrator only:</strong>
        <span>
          This app coordinates existing reusable capabilities. It does not duplicate analyzer, asset generation, interaction simulation, recording, capture or video-processing implementations.
        </span>
      </section>

      <section className="orchestrator-grid orchestrator-grid--top">
        <div className="orchestrator-card">
          <h2>Demo job</h2>
          <label>
            Website / app URL
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          </label>
          <label>
            Preferred strategy
            <select value={strategy} onChange={(e) => setStrategy(e.target.value as DemoWorkflowStrategy | '')}>
              <option value="">Auto choose</option>
              <option value="direct-accessible">Direct / accessible analysis</option>
              <option value="snapshot-local-simulation">Snapshot / local simulation</option>
              <option value="visual-capture-fallback">User-permitted visual capture fallback</option>
            </select>
          </label>
          <div className="orchestrator-row orchestrator-wrap">
            <button type="button" onClick={build}>Build workflow plan</button>
            <button type="button" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run available stages'}</button>
            <label className="orchestrator-file">
              Import state
              <input type="file" accept=".json,application/json" onChange={importState} />
            </label>
          </div>
        </div>

        <div className="orchestrator-card">
          <h2>Registered stage adapters</h2>
          {!registered.length ? (
            <p className="orchestrator-warning">
              No runtime adapters are registered in this standalone page session yet. The workflow plan remains valid and pauses truthfully instead of pretending other apps executed.
            </p>
          ) : (
            <ul>{registered.map((adapter) => <li key={adapter.stage}>{adapter.stage} → {adapter.appId}</li>)}</ul>
          )}
          <button
            type="button"
            onClick={() => downloadBlob(exportWorkflowState(state), 'automated-demo-workflow-state.json')}
          >
            Export workflow state
          </button>
        </div>
      </section>

      <section className="orchestrator-status">{status}</section>

      <section className="orchestrator-card">
        <div className="orchestrator-header">
          <div>
            <h2>Workflow stages</h2>
            <p className="orchestrator-muted">Strategy: {state.strategy || 'not chosen yet'} · Status: {state.status}</p>
          </div>
        </div>
        <div className="orchestrator-stages">
          {state.stages.map((stage, index) => (
            <article className={`orchestrator-stage orchestrator-stage--${stage.status}`} key={stage.id}>
              <div className="orchestrator-index">{index + 1}</div>
              <div>
                <strong>{stage.label}</strong>
                <div className="orchestrator-muted">
                  {stage.id} · {stage.status} · attempts {stage.attempts}
                </div>
                {stage.message ? <p>{stage.message}</p> : null}
                {stage.error ? <p className="orchestrator-error">{stage.error}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="orchestrator-grid">
        <div className="orchestrator-card">
          <h2>Stage outputs</h2>
          <pre className="orchestrator-code">{JSON.stringify(state.outputs, null, 2)}</pre>
        </div>
        <div className="orchestrator-card">
          <h2>Final module chain</h2>
          <div className="orchestrator-pipeline">
            <span>#021 Analyze</span><b>→</b>
            <span>#022 Snapshot</span><b>→</b>
            <span>#023 Flow</span><b>→</b>
            <span>#024 Assets</span><b>→</b>
            <span>#020 Simulate</span><b>→</b>
            <span>#018/#025 Capture</span><b>→</b>
            <span>#019 Process</span>
          </div>
          {state.warnings.length ? (
            <>
              <h3>Warnings / checkpoints</h3>
              <ul>{state.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </>
          ) : null}
        </div>
      </section>
    </div>
  )
}

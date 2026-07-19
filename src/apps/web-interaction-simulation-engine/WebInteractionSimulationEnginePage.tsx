import { useMemo, useRef, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { SimulationStage } from './components/SimulationStage'
import { createDomSimulationSurface } from './lib/domSurface'
import { createSampleSequence } from './lib/sampleSequence'
import { SimulationController } from './lib/simulationEngine'
import { parseSequenceJson, sequenceSummary } from './lib/sequenceUtils'
import type { DemoSequence, SimulationProgress } from './types/demoActions'
import './WebInteractionSimulationEngine.css'

export function WebInteractionSimulationEnginePage() {
  const initial = useMemo(() => createSampleSequence(), [])
  const [json, setJson] = useState(() => JSON.stringify(initial, null, 2))
  const [sequence, setSequence] = useState<DemoSequence>(initial)
  const [status, setStatus] = useState('Sample sequence loaded. Edit JSON or press Play.')
  const [progress, setProgress] = useState<SimulationProgress>({ status: 'idle', actionIndex: 0, totalActions: initial.actions.length })
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<SimulationController | null>(null)

  const applyJson = () => {
    const parsed = parseSequenceJson(json)
    if (!parsed.valid || !parsed.sequence) {
      setStatus(parsed.errors.join(' '))
      return
    }
    setSequence(parsed.sequence)
    setProgress({ status: 'idle', actionIndex: 0, totalActions: parsed.sequence.actions.length })
    setStatus(`Valid sequence. ${sequenceSummary(parsed.sequence)}`)
  }

  const loadSample = () => {
    const sample = createSampleSequence()
    setSequence(sample)
    setJson(JSON.stringify(sample, null, 2))
    setProgress({ status: 'idle', actionIndex: 0, totalActions: sample.actions.length })
    setStatus('Sample sequence restored.')
  }

  const play = async () => {
    if (!stageRef.current || running) return
    const parsed = parseSequenceJson(json)
    if (!parsed.valid || !parsed.sequence) { setStatus(parsed.errors.join(' ')); return }
    const nextSequence = parsed.sequence
    setSequence(nextSequence)
    setRunning(true)
    setPaused(false)
    setStatus('Running browser-local simulation…')
    const controller = new SimulationController({ onProgress: setProgress })
    controllerRef.current = controller
    const result = await controller.run(nextSequence, createDomSimulationSurface(stageRef.current))
    controllerRef.current = null
    setRunning(false)
    setPaused(false)
    setStatus(result.status === 'completed' ? `Completed ${result.completedActions}/${result.totalActions} actions.` : result.error || 'Simulation cancelled.')
  }

  const togglePause = () => {
    if (!controllerRef.current) return
    if (paused) controllerRef.current.resume()
    else controllerRef.current.pause()
    setPaused(!paused)
  }

  const exportSequence = () => {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'demo-interaction-sequence.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 5_000)
  }

  return (
    <div className="wis-page">
      <ToolAppHeader
        appNumber="020"
        title="Web Interaction Simulation Engine"
        description="Create, validate and visually simulate reusable structured demo actions locally in your browser."
      />

      <div className="wis-grid">
        <section className="wis-card wis-editor-card">
          <div className="wis-card-head"><div><h2>Structured Demo Sequence</h2><p>Standard action schema for future demo workflow modules.</p></div><span className="wis-count">{sequence.actions.length} actions</span></div>
          <textarea className="wis-json" value={json} onChange={(event) => setJson(event.target.value)} spellCheck={false} aria-label="Demo sequence JSON" />
          <div className="wis-actions">
            <button type="button" onClick={applyJson} disabled={running}>Validate & Apply</button>
            <button type="button" className="wis-secondary" onClick={loadSample} disabled={running}>Load Sample</button>
            <button type="button" className="wis-secondary" onClick={exportSequence}>Export JSON</button>
          </div>
        </section>

        <section className="wis-card">
          <div className="wis-card-head"><div><h2>Simulation Playground</h2><p>Controlled local surface for truthful visual execution.</p></div><span className={`wis-status wis-${progress.status}`}>{progress.status}</span></div>
          <SimulationStage ref={stageRef} />
          <div className="wis-player">
            <button type="button" onClick={() => void play()} disabled={running}>▶ Play</button>
            <button type="button" className="wis-secondary" onClick={togglePause} disabled={!running}>{paused ? 'Resume' : 'Pause'}</button>
            <button type="button" className="wis-secondary" onClick={() => controllerRef.current?.cancel()} disabled={!running}>Stop</button>
          </div>
          <div className="wis-progress"><div style={{ width: `${progress.totalActions ? Math.min(100, (progress.actionIndex / progress.totalActions) * 100) : 0}%` }} /></div>
          <p className="wis-message">{status}</p>
        </section>
      </div>

      <section className="wis-card wis-schema-card">
        <h2>Reusable Action Contract</h2>
        <div className="wis-chip-row">{['move','click','doubleClick','type','scroll','select','upload','drag','drop','focus','highlight','zoom','wait'].map((type) => <code key={type}>{type}</code>)}</div>
        <p>The engine operates on a <code>DemoSequence</code> and a pluggable <code>SimulationSurface</code>. Later analyzers, flow builders and orchestrators can generate the same sequence format without duplicating playback logic.</p>
      </section>
    </div>
  )
}

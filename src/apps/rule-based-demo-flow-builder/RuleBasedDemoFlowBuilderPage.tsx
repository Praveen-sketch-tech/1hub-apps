import { ChangeEvent, useMemo, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import {
  buildDemoFlows,
  createManualFlow,
  reorderSteps,
  setPrimaryFlow,
} from './lib/flowBuilder'
import { convertFlowToDemoSequence, exportDemoSequence } from './lib/interactionAdapter'
import {
  exportDemoFlowCollection,
  parseDemoFlowCollection,
  parsePageFeatureMap,
  validateDemoFlowCollection,
} from './lib/flowValidation'
import type {
  DemoFlow,
  DemoFlowCollection,
  DemoStep,
  PageFeatureMap,
} from './types/demoFlow'
import './RuleBasedDemoFlowBuilder.css'

const SAMPLE_MAP: PageFeatureMap = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: {
    title: 'Sample Image Tool',
    url: 'https://example.com/image-tool',
    mode: 'snapshot-ready',
  },
  access: {
    mode: 'snapshot-ready',
    directDomAccess: false,
    sourceAvailable: true,
    nextBestMode: 'snapshot-local-simulation',
  },
  summary: {
    headings: 1,
    buttons: 2,
    links: 0,
    forms: 1,
    inputs: 2,
    textareas: 0,
    selects: 1,
    tabs: 0,
    fileUploads: 1,
    downloads: 1,
    primaryCtas: 1,
    sections: 2,
  },
  features: [
    {
      id: 'upload-image',
      kind: 'file-upload',
      label: 'Upload Image',
      inputType: 'file',
      confidence: 0.98,
      attributes: { accept: 'image/*' },
    },
    {
      id: 'quality',
      kind: 'input',
      label: 'Quality',
      inputType: 'range',
      confidence: 0.9,
      attributes: { value: '80' },
    },
    {
      id: 'format',
      kind: 'select',
      label: 'Output Format',
      confidence: 0.9,
      attributes: { value: 'webp' },
    },
    {
      id: 'process',
      kind: 'primary-cta',
      label: 'Compress Image',
      confidence: 0.99,
    },
    {
      id: 'preview',
      kind: 'section',
      label: 'Preview Result',
      confidence: 0.8,
    },
    {
      id: 'download',
      kind: 'download',
      label: 'Download Image',
      confidence: 0.96,
    },
  ],
  workflowHints: [
    { id: 'h1', label: 'Upload', role: 'input', featureIds: ['upload-image'], confidence: 0.99 },
    { id: 'h2', label: 'Configure', role: 'configure', featureIds: ['quality', 'format'], confidence: 0.9 },
    { id: 'h3', label: 'Process', role: 'process', featureIds: ['process'], confidence: 0.99 },
    { id: 'h4', label: 'Preview', role: 'preview', featureIds: ['preview'], confidence: 0.8 },
    { id: 'h5', label: 'Download', role: 'download', featureIds: ['download'], confidence: 0.96 },
  ],
  repeatedLabels: [],
  notes: [],
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function RuleBasedDemoFlowBuilderPage() {
  const [mapText, setMapText] = useState(JSON.stringify(SAMPLE_MAP, null, 2))
  const [map, setMap] = useState<PageFeatureMap>(SAMPLE_MAP)
  const [collection, setCollection] = useState<DemoFlowCollection>(() => buildDemoFlows(SAMPLE_MAP))
  const [selectedFlowId, setSelectedFlowId] = useState(() => collection.primaryFlowId)
  const [status, setStatus] = useState('Sample Page Map loaded. Generate or edit the deterministic flow.')

  const selectedFlow = useMemo(
    () => collection.flows.find((flow) => flow.id === selectedFlowId) ?? collection.flows[0],
    [collection, selectedFlowId],
  )

  const validation = useMemo(() => validateDemoFlowCollection(collection), [collection])
  const sequence = useMemo(
    () => selectedFlow ? convertFlowToDemoSequence(selectedFlow, map) : null,
    [selectedFlow, map],
  )

  const generate = () => {
    try {
      const parsed = parsePageFeatureMap(mapText)
      const next = buildDemoFlows(parsed)
      setMap(parsed)
      setCollection(next)
      setSelectedFlowId(next.primaryFlowId)
      setStatus(`Generated ${next.flows.length} deterministic flow(s).`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not parse Page Map JSON.')
    }
  }

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      if (/demo[-_ ]?flow/i.test(file.name)) {
        const imported = parseDemoFlowCollection(text)
        setCollection(imported)
        setSelectedFlowId(imported.primaryFlowId)
        setStatus(`Imported ${imported.flows.length} demo flow(s).`)
      } else {
        const parsed = parsePageFeatureMap(text)
        setMap(parsed)
        setMapText(JSON.stringify(parsed, null, 2))
        const next = buildDemoFlows(parsed)
        setCollection(next)
        setSelectedFlowId(next.primaryFlowId)
        setStatus(`Loaded App #021 Page Map and generated ${next.flows.length} flow(s).`)
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not import JSON.')
    }
  }

  const updateSelectedFlow = (updater: (flow: DemoFlow) => DemoFlow) => {
    setCollection((current) => ({
      ...current,
      flows: current.flows.map((flow) => flow.id === selectedFlowId ? updater(flow) : flow),
    }))
  }

  const updateStep = (stepId: string, patch: Partial<DemoStep>) => {
    updateSelectedFlow((flow) => ({
      ...flow,
      steps: flow.steps.map((step) => step.id === stepId ? { ...step, ...patch } : step),
    }))
  }

  const moveStep = (index: number, offset: number) => {
    const target = index + offset
    if (!selectedFlow || target < 0 || target >= selectedFlow.steps.length) return
    updateSelectedFlow((flow) => reorderSteps(flow, index, target))
  }

  const addManualFlow = () => {
    const flow = createManualFlow(`Manual Demo Flow ${collection.flows.length + 1}`)
    setCollection((current) => ({
      ...current,
      flows: [...current.flows.map((item) => ({ ...item, isPrimary: false })), flow],
      primaryFlowId: flow.id,
    }))
    setSelectedFlowId(flow.id)
    setStatus('Added a manual editable fallback flow.')
  }

  const choosePrimary = (flowId: string) => {
    setCollection((current) => setPrimaryFlow(current, flowId))
    setSelectedFlowId(flowId)
  }

  return (
    <div className="tool-page flow-page">
      <ToolAppHeader
        appNumber="023"
        title="Rule-Based Demo Flow Builder"
        description="Generate deterministic, editable demo workflows from structured Page Maps and convert them into reusable interaction sequences without AI."
      />

      <section className="flow-grid flow-grid--top">
        <div className="flow-card">
          <div className="flow-card-header">
            <div>
              <h2>Page Map / Feature Map input</h2>
              <p className="flow-muted">Accepts the structured JSON contract produced by App #021.</p>
            </div>
            <label className="flow-file-button">
              Import JSON
              <input type="file" accept=".json,application/json" onChange={importJson} />
            </label>
          </div>
          <textarea rows={18} value={mapText} onChange={(e) => setMapText(e.target.value)} />
          <div className="flow-row flow-row--wrap">
            <button type="button" onClick={generate}>Generate rule-based flows</button>
            <button type="button" onClick={addManualFlow}>Add manual fallback flow</button>
          </div>
        </div>

        <div className="flow-card">
          <h2>Generation summary</h2>
          <div className="flow-stat-grid">
            <span><strong>{collection.flows.length}</strong> flows</span>
            <span><strong>{selectedFlow?.steps.length ?? 0}</strong> steps</span>
            <span><strong>{selectedFlow?.assetRequirements.length ?? 0}</strong> assets</span>
            <span><strong>{sequence?.actions.length ?? 0}</strong> actions</span>
          </div>

          <h3>Validation</h3>
          <div className={validation.valid ? 'flow-validation flow-validation--ok' : 'flow-validation flow-validation--error'}>
            {validation.valid ? 'Valid flow collection' : validation.errors.join(' ')}
          </div>
          {validation.warnings.length ? (
            <ul>{validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          ) : null}

          <h3>Pipeline handoff</h3>
          <div className="flow-pipeline">
            <span>App #021 Page Map</span>
            <b>→</b>
            <span>App #023 Demo Flow</span>
            <b>→</b>
            <span>App #024 Asset Requirements</span>
            <b>→</b>
            <span>App #020 DemoSequence</span>
          </div>
        </div>
      </section>

      <section className="flow-status">{status}</section>

      <section className="flow-card">
        <div className="flow-card-header">
          <div>
            <h2>Flows</h2>
            <p className="flow-muted">Choose the primary workflow or inspect alternative deterministic flows.</p>
          </div>
          <div className="flow-row flow-row--wrap">
            {collection.flows.map((flow) => (
              <button
                type="button"
                key={flow.id}
                className={flow.id === selectedFlowId ? 'flow-button-active' : ''}
                onClick={() => setSelectedFlowId(flow.id)}
              >
                {flow.isPrimary ? '★ ' : ''}{flow.name}
              </button>
            ))}
          </div>
        </div>
        {selectedFlow && !selectedFlow.isPrimary ? (
          <button type="button" onClick={() => choosePrimary(selectedFlow.id)}>Set selected flow as primary</button>
        ) : null}
      </section>

      {selectedFlow ? (
        <section className="flow-grid">
          <div className="flow-card">
            <h2>Editable demo steps</h2>
            <div className="flow-step-list">
              {selectedFlow.steps.map((step, index) => (
                <article className="flow-step" key={step.id}>
                  <div className="flow-step-index">{index + 1}</div>
                  <div className="flow-step-body">
                    <div className="flow-row flow-row--spread">
                      <label className="flow-checkbox">
                        <input
                          type="checkbox"
                          checked={step.enabled}
                          onChange={(e) => updateStep(step.id, { enabled: e.target.checked })}
                        />
                        Enabled
                      </label>
                      <span className="flow-pill">{step.role}</span>
                    </div>
                    <label>
                      Step label
                      <input value={step.label} onChange={(e) => updateStep(step.id, { label: e.target.value })} />
                    </label>
                    <label>
                      Caption
                      <input value={step.caption} onChange={(e) => updateStep(step.id, { caption: e.target.value })} />
                    </label>
                    <label>
                      Wait after step (ms)
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={step.waitAfterMs}
                        onChange={(e) => updateStep(step.id, { waitAfterMs: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </label>
                    <div className="flow-row">
                      <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0}>↑ Up</button>
                      <button type="button" onClick={() => moveStep(index, 1)} disabled={index === selectedFlow.steps.length - 1}>↓ Down</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="flow-card">
            <h2>App #024 asset requirements</h2>
            {!selectedFlow.assetRequirements.length ? (
              <p className="flow-muted">No file upload requirement detected in this flow.</p>
            ) : (
              <div className="flow-asset-list">
                {selectedFlow.assetRequirements.map((asset) => (
                  <div className="flow-asset" key={asset.id}>
                    <strong>{asset.label}</strong>
                    <span>{asset.suggestedAssetKind}</span>
                    <small>{asset.accept || 'Any file type'}</small>
                  </div>
                ))}
              </div>
            )}

            <h2>App #020 DemoSequence preview</h2>
            <pre className="flow-code">{JSON.stringify(sequence, null, 2)}</pre>
            <div className="flow-row flow-row--wrap">
              <button
                type="button"
                onClick={() => downloadBlob(exportDemoFlowCollection(collection), 'rule-based-demo-flows.json')}
              >
                Export Demo Flow JSON
              </button>
              <button
                type="button"
                disabled={!sequence}
                onClick={() => sequence && downloadBlob(exportDemoSequence(sequence), 'app-020-demo-sequence.json')}
              >
                Export App #020 sequence
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

import { ChangeEvent, useMemo, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import {
  buildAssetMappingPlanFromCollection,
  exportAssetMappingPlan,
  parseDemoFlowCollection,
} from './lib/mapper'
import { executeAssetMappingPlan, getAssetFactoryAdapter } from './lib/assetFactoryBridge'
import { mapUserFileToRequirement } from './lib/userAssetMapping'
import type {
  AssetMappingPlan,
  DemoFlowCollection,
  GeneratedAsset,
} from './types/assetMapping'
import './SmartAssetToActionMapper.css'

const SAMPLE_FLOW: DemoFlowCollection = {
  version: 1,
  sourceTitle: 'Sample Image Tool',
  sourceUrl: 'https://example.com/tool',
  generatedAt: new Date().toISOString(),
  primaryFlowId: 'flow-primary',
  flows: [{
    version: 1,
    id: 'flow-primary',
    name: 'Sample Image Tool — Primary Demo Flow',
    generatedAt: new Date().toISOString(),
    generationMode: 'rules',
    isPrimary: true,
    steps: [{
      id: 'step-upload',
      role: 'input',
      label: 'Upload Image',
      caption: 'Provide an image.',
      enabled: true,
      waitAfterMs: 250,
      featureIds: ['upload-image'],
      confidence: 0.99,
    }],
    assetRequirements: [{
      id: 'asset-image',
      stepId: 'step-upload',
      featureId: 'upload-image',
      label: 'Upload Image',
      inputType: 'file',
      accept: 'image/*',
      suggestedAssetKind: 'image',
    }],
    warnings: [],
  }],
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function SmartAssetToActionMapperPage() {
  const [flowText, setFlowText] = useState(JSON.stringify(SAMPLE_FLOW, null, 2))
  const [plan, setPlan] = useState<AssetMappingPlan>(() =>
    buildAssetMappingPlanFromCollection(SAMPLE_FLOW),
  )
  const [assets, setAssets] = useState<GeneratedAsset[]>([])
  const [status, setStatus] = useState(
    'Sample App #023 flow loaded. Build a mapping plan or attach local files.',
  )

  const adapterAvailable = !!getAssetFactoryAdapter()
  const mappedCount = useMemo(
    () => plan.mappings.filter((mapping) => mapping.status === 'mapped').length,
    [plan],
  )

  const buildPlan = () => {
    try {
      const collection = parseDemoFlowCollection(flowText)
      const next = buildAssetMappingPlanFromCollection(collection)
      setPlan(next)
      setAssets([])
      setStatus(`Created ${next.mappings.length} asset-to-action mapping(s).`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not parse Demo Flow JSON.')
    }
  }

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const collection = parseDemoFlowCollection(text)
      const next = buildAssetMappingPlanFromCollection(collection)
      setFlowText(JSON.stringify(collection, null, 2))
      setPlan(next)
      setAssets([])
      setStatus(`Imported ${file.name} and created ${next.mappings.length} mapping(s).`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not import Demo Flow JSON.')
    }
  }

  const mapFile = async (requirementId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const result = mapUserFileToRequirement(plan, requirementId, file)
      setPlan(result.plan)
      setAssets((current) => [
        ...current.filter((asset) => asset.id !== result.asset.id),
        result.asset,
      ])
      setStatus(`Mapped ${file.name} to the selected upload requirement.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not map this file.')
    }
  }

  const generateWithApp017 = async () => {
    try {
      const result = await executeAssetMappingPlan(plan)
      setPlan(result.plan)
      setAssets(result.assets)
      setStatus(`Generated and mapped ${result.assets.length} asset(s) through the registered App #017 adapter.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'App #017 generation adapter is unavailable.')
    }
  }

  return (
    <div className="tool-page asset-map-page">
      <ToolAppHeader
        appNumber="024"
        title="Smart Asset-to-Action Mapper"
        description="Map demo file-input requirements to reusable test-asset generation requests and upload actions without duplicating App #017 generation logic."
      />

      <section className="asset-map-notice">
        <strong>Single source of asset generation:</strong>
        <span>
          App #024 decides what asset is needed and where it belongs. Actual generated assets are delegated to App #017 through a reusable runtime adapter; user-provided local files can also be mapped directly.
        </span>
      </section>

      <section className="asset-map-grid asset-map-grid--top">
        <div className="asset-map-card">
          <div className="asset-map-header">
            <div>
              <h2>App #023 Demo Flow input</h2>
              <p className="asset-map-muted">Paste or import a Demo Flow collection containing assetRequirements.</p>
            </div>
            <label className="asset-map-file-button">
              Import JSON
              <input type="file" accept=".json,application/json" onChange={importJson} />
            </label>
          </div>
          <textarea rows={18} value={flowText} onChange={(e) => setFlowText(e.target.value)} />
          <button type="button" onClick={buildPlan}>Build asset mapping plan</button>
        </div>

        <div className="asset-map-card">
          <h2>Mapping summary</h2>
          <div className="asset-map-stats">
            <span><strong>{plan.mappings.length}</strong> requirements</span>
            <span><strong>{mappedCount}</strong> mapped</span>
            <span><strong>{plan.mappings.length - mappedCount}</strong> pending</span>
            <span><strong>{adapterAvailable ? 'Yes' : 'No'}</strong> App #017 adapter</span>
          </div>
          <div className="asset-map-row asset-map-row--wrap">
            <button type="button" disabled={!adapterAvailable || !plan.mappings.length} onClick={generateWithApp017}>
              Generate pending assets via App #017
            </button>
            <button
              type="button"
              onClick={() => downloadBlob(exportAssetMappingPlan(plan), 'asset-to-action-mapping-plan.json')}
            >
              Export mapping plan
            </button>
          </div>
          {!adapterAvailable ? (
            <p className="asset-map-warning">
              App #017 adapter is not registered in this runtime. Mapping still works; automatic generation remains truthfully pending instead of duplicating or faking App #017 logic.
            </p>
          ) : null}
        </div>
      </section>

      <section className="asset-map-status">{status}</section>

      <section className="asset-map-card">
        <h2>Asset requirements → generation → upload actions</h2>
        {!plan.mappings.length ? (
          <p className="asset-map-muted">No file-input requirements found in the primary flow.</p>
        ) : (
          <div className="asset-map-list">
            {plan.mappings.map((mapping, index) => (
              <article className="asset-map-item" key={mapping.id}>
                <div className="asset-map-index">{index + 1}</div>
                <div className="asset-map-body">
                  <div className="asset-map-row asset-map-row--spread">
                    <div>
                      <strong>{mapping.requirement.label}</strong>
                      <div className="asset-map-muted">
                        {mapping.requirement.suggestedAssetKind} · {mapping.requirement.accept || 'any file'}
                      </div>
                    </div>
                    <span className={`asset-map-pill asset-map-pill--${mapping.status}`}>
                      {mapping.status}
                    </span>
                  </div>

                  <div className="asset-map-columns">
                    <div>
                      <h3>App #017 generation request</h3>
                      <pre>{JSON.stringify(mapping.generationRequest, null, 2)}</pre>
                    </div>
                    <div>
                      <h3>App #020 upload action</h3>
                      <pre>{JSON.stringify(mapping.uploadAction, null, 2)}</pre>
                    </div>
                  </div>

                  {mapping.asset ? (
                    <p><strong>Mapped asset:</strong> {mapping.asset.name} ({mapping.asset.mimeType})</p>
                  ) : (
                    <label className="asset-map-file-button asset-map-file-button--inline">
                      Map your own local file
                      <input
                        type="file"
                        accept={mapping.requirement.accept}
                        onChange={(event) => mapFile(mapping.requirement.id, event)}
                      />
                    </label>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="asset-map-grid">
        <div className="asset-map-card">
          <h2>Structured mapping plan</h2>
          <pre className="asset-map-code">{JSON.stringify(plan, null, 2)}</pre>
        </div>
        <div className="asset-map-card">
          <h2>Pipeline contract</h2>
          <div className="asset-map-pipeline">
            <span>App #023 assetRequirements</span>
            <b>→</b>
            <span>App #024 mapping requests</span>
            <b>→</b>
            <span>App #017 reusable generator</span>
            <b>→</b>
            <span>App #020 upload actions</span>
          </div>
          <p className="asset-map-muted">
            Future App #026 can register the real App #017 adapter once, execute this mapping plan, then pass generated Blobs/files into the interaction workflow.
          </p>
          <p><strong>Runtime assets currently held:</strong> {assets.length}</p>
        </div>
      </section>
    </div>
  )
}

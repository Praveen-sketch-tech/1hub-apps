import { analyzeDocument, probeUrlAccessibility } from '@apps/website-structure-feature-analyzer/lib/analyzer'
import type { PageFeatureMap } from '@apps/website-structure-feature-analyzer/types/pageMap'
import { buildDemoFlows } from '@apps/rule-based-demo-flow-builder/lib/flowBuilder'
import { convertFlowToDemoSequence } from '@apps/rule-based-demo-flow-builder/lib/interactionAdapter'
import { buildAssetMappingPlanFromCollection } from '@apps/smart-asset-to-action-mapper/lib/mapper'
import {
  executeAssetMappingPlan,
  registerAssetFactoryAdapter,
} from '@apps/smart-asset-to-action-mapper/lib/assetFactoryBridge'
import type {
  AssetFactoryCapability,
  AssetGenerationRequest,
  GeneratedAsset as MappedGeneratedAsset,
} from '@apps/smart-asset-to-action-mapper/types/assetMapping'
import { generateTestAsset } from '@apps/universal-test-asset-factory/lib/assetFactory'
import type { AssetGenerationOptions } from '@apps/universal-test-asset-factory/types'
import {
  createSnapshotProject,
  fetchAccessibleHtml,
} from '@apps/web-page-snapshot-local-simulation/lib/snapshotEngine'
import { sequenceToVisualCapturePlan } from '@apps/visual-capture-demo-fallback-engine/lib/plan'
import { captureWithVisualPlan } from '@apps/visual-capture-demo-fallback-engine/lib/capture'
import { createDefaultEditPlan, createSource } from '@apps/browser-video-processing-studio/lib/videoProcessing'
import { inspectVideo } from '@apps/browser-video-processing-studio/lib/inspectVideo'
import { processEditPlan } from '@apps/browser-video-processing-studio/lib/editPlanProcessor'
import {
  createDemoWorkflowJob,
  createInitialWorkflowState,
  runDemoWorkflow,
} from '@apps/automated-demo-workflow-orchestrator/lib/orchestrator'
import { registerDemoWorkflowCapabilities } from '@apps/automated-demo-workflow-orchestrator/lib/adapters'
import { registerFinalDemoOrchestratorAdapter } from '@apps/automatic-website-demo-video-generator/lib/orchestratorBridge'
import type { DemoWorkflowState } from '@apps/automated-demo-workflow-orchestrator/types/workflow'
import type { DemoSequence } from '@apps/rule-based-demo-flow-builder/types/demoFlow'

let initialized = false
let cleanupFns: Array<() => void> = []

function sameOrigin(url: string) {
  try {
    return typeof window !== 'undefined' && new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

async function analyzeSameOriginRenderedPage(url: string): Promise<PageFeatureMap> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.tabIndex = -1
    iframe.style.position = 'fixed'
    iframe.style.left = '-10000px'
    iframe.style.top = '0'
    iframe.style.width = '1280px'
    iframe.style.height = '900px'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'

    const timer = window.setTimeout(() => {
      iframe.remove()
      reject(new Error('Timed out while rendering the same-origin target page.'))
    }, 12000)

    iframe.onload = () => {
      window.setTimeout(() => {
        try {
          const doc = iframe.contentDocument
          if (!doc) throw new Error('Rendered page document is unavailable.')
          const result = analyzeDocument(doc, { url, mode: 'same-origin-document' })
          clearTimeout(timer)
          iframe.remove()
          resolve(result)
        } catch (error) {
          clearTimeout(timer)
          iframe.remove()
          reject(error)
        }
      }, 900)
    }

    iframe.onerror = () => {
      clearTimeout(timer)
      iframe.remove()
      reject(new Error('Could not load the same-origin target page.'))
    }

    iframe.src = url
    document.body.appendChild(iframe)
  })
}

function optionsForCapability(request: AssetGenerationRequest): AssetGenerationOptions | null {
  const baseName = request.suggestedFileName.replace(/\.[^.]+$/, '')
  const options: Partial<Record<AssetFactoryCapability, AssetGenerationOptions>> = {
    'generate-image': { assetType: 'png', preset: 'test-pattern', width: 1280, height: 720, fileName: baseName },
    'generate-ocr-image': { assetType: 'png', preset: 'ocr-document', width: 1200, height: 1600, scanStyle: true, fileName: baseName },
    'generate-scanned-pdf': { assetType: 'pdf', preset: 'scanned-document', pageCount: 2, scanStyle: true, fileName: baseName },
    'generate-pdf': { assetType: 'pdf', preset: 'clean-document', pageCount: 2, fileName: baseName },
    'generate-spreadsheet': { assetType: 'xlsx', rowCount: 20, sheetCount: 2, includeFormulas: true, fileName: baseName },
    'generate-document': { assetType: 'txt', fileName: baseName },
    'generate-qr-image': { assetType: 'png', preset: 'qr', width: 900, height: 900, fileName: baseName },
    'generate-barcode-image': { assetType: 'png', preset: 'barcode', width: 1200, height: 700, fileName: baseName },
  }
  return options[request.capability] ?? null
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.left = '-10000px'
  canvas.style.top = '0'
  document.body.appendChild(canvas)
  return canvas
}

export function initializeDemoRuntime(): () => void {
  if (initialized) return () => undefined
  initialized = true

  cleanupFns.push(registerAssetFactoryAdapter({
    providerAppId: 'universal-test-asset-factory',
    supports(capability) {
      return optionsForCapability({
        id: 'probe',
        requirementId: 'probe',
        capability,
        requestedKind: 'generic-file',
        preferredMimeTypes: [],
        suggestedFileName: 'demo-asset',
        reason: 'capability probe',
        providerAppId: 'universal-test-asset-factory',
      }) !== null
    },
    async generate(request): Promise<MappedGeneratedAsset> {
      const options = optionsForCapability(request)
      if (!options) throw new Error(`App #017 does not currently generate ${request.capability}.`)
      const asset = await generateTestAsset(options)
      return {
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `asset-${Date.now()}`,
        name: asset.fileName,
        mimeType: asset.mimeType,
        blob: asset.blob,
        source: 'app-017',
        capability: request.capability,
      }
    },
  }))

  cleanupFns.push(registerDemoWorkflowCapabilities({
    async analyze({ job }) {
      if (!job.url) throw new Error('A target URL is required.')
      let map: PageFeatureMap
      if (sameOrigin(job.url)) {
        try {
          map = await analyzeSameOriginRenderedPage(job.url)
        } catch {
          map = await probeUrlAccessibility(job.url)
        }
      } else {
        map = await probeUrlAccessibility(job.url)
      }
      return {
        output: map,
        message: `Analyzed target with ${map.features.length} detected features using ${map.access.mode}.`,
      }
    },

    async snapshot({ job, state }) {
      const map = state.outputs.pageMap as PageFeatureMap | undefined
      if (!job.url) throw new Error('A target URL is required.')
      if (!map?.access.sourceAvailable) {
        return {
          requiresUser: true,
          suggestedStrategy: 'visual-capture-fallback',
          message: 'Page source is unavailable. Continue with user-permitted visual capture.',
        }
      }
      const fetched = await fetchAccessibleHtml(job.url)
      const project = createSnapshotProject({
        title: map.source.title || job.title || 'Demo snapshot',
        sourceUrl: job.url,
        html: fetched.html,
        accessMode: 'accessible-html',
      })
      return { output: project, message: 'Created a browser-local snapshot project from accessible HTML.' }
    },

    async buildFlow({ state }) {
      const map = state.outputs.pageMap as PageFeatureMap | undefined
      if (!map) throw new Error('App #021 page analysis output is missing.')
      const collection = buildDemoFlows(map)
      return {
        output: collection,
        message: `Built ${collection.flows.length} rule-based demo flow${collection.flows.length === 1 ? '' : 's'}.`,
      }
    },

    async prepareAssets({ state }) {
      const collection = state.outputs.demoFlow as ReturnType<typeof buildDemoFlows> | undefined
      if (!collection) throw new Error('App #023 demo flow output is missing.')
      const plan = buildAssetMappingPlanFromCollection(collection)
      const executed = await executeAssetMappingPlan(plan)
      return {
        output: executed,
        message: executed.assets.length
          ? `Generated and mapped ${executed.assets.length} reusable test asset${executed.assets.length === 1 ? '' : 's'} through App #017.`
          : 'No generated test assets were required for this flow.',
      }
    },

    async simulate({ state }) {
      const map = state.outputs.pageMap as PageFeatureMap | undefined
      const collection = state.outputs.demoFlow as ReturnType<typeof buildDemoFlows> | undefined
      if (!map || !collection) throw new Error('Page map or demo flow is missing.')
      const flow = collection.flows.find((item) => item.id === collection.primaryFlowId) ?? collection.flows.find((item) => item.isPrimary) ?? collection.flows[0]
      if (!flow) throw new Error('Demo Flow collection contains no flows.')
      const sequence = convertFlowToDemoSequence(flow, map)
      const assetResult = state.outputs.assetMapping as { plan?: { mappings?: Array<{ uploadAction?: { targetId: string; fileName: string; fileType?: string } }> } } | undefined
      const mappedUploads = new Map(
        (assetResult?.plan?.mappings ?? []).map((item) => [item.uploadAction?.targetId, item.uploadAction]),
      )
      const hydrated: DemoSequence = {
        ...sequence,
        actions: sequence.actions.map((action) => {
          if (action.type !== 'upload') return action
          const mapped = mappedUploads.get(action.targetId)
          return mapped ? { ...action, fileName: mapped.fileName, fileType: mapped.fileType } : action
        }),
      }
      return {
        output: hydrated,
        message: `Prepared ${hydrated.actions.length} reusable App #020 interaction actions for capture execution.`,
      }
    },

    async capture({ state }) {
      const sequence = state.outputs.simulationResult as DemoSequence | undefined
      if (!sequence) throw new Error('App #020 interaction sequence is missing.')
      const plan = sequenceToVisualCapturePlan(sequence)
      const canvas = createCanvas()
      try {
        const result = await captureWithVisualPlan(canvas, plan)
        return { output: result, message: 'Captured the user-selected visible tab/window with App #025 visual demo cues.' }
      } finally {
        canvas.remove()
      }
    },

    async processVideo({ state }) {
      const capture = state.outputs.captureResult as {
        blob?: Blob
        fileName?: string
        durationMs?: number
        width?: number
        height?: number
      } | undefined
      if (!capture?.blob) throw new Error('Capture output is missing.')
      const metadata = await inspectVideo(capture.blob, capture.fileName || 'demo-capture.webm')
      const source = createSource(capture.blob)
      const plan = createDefaultEditPlan(source, metadata.duration, metadata.width, metadata.height)
      plan.export.fileName = 'website-demo-video.webm'
      const processed = await processEditPlan(plan)
      return {
        output: {
          blob: processed.blob,
          fileName: processed.fileName,
          mimeType: processed.mimeType,
          durationMs: Math.round(processed.duration * 1000),
          width: processed.width,
          height: processed.height,
        },
        message: 'Processed the captured demo through App #019 and produced the final WebM video.',
      }
    },
  }))

  cleanupFns.push(registerFinalDemoOrchestratorAdapter({
    appId: 'automated-demo-workflow-orchestrator',
    createJob(input) {
      return createInitialWorkflowState(createDemoWorkflowJob({
        url: input.url,
        preferredStrategy: input.preferredStrategy,
      })) as unknown as import('@apps/automatic-website-demo-video-generator/types/finalDemo').DemoWorkflowState
    },
    async run(state, options) {
      return runDemoWorkflow(
        state as unknown as DemoWorkflowState,
        options as Parameters<typeof runDemoWorkflow>[1],
      ) as unknown as Promise<{
        state: import('@apps/automatic-website-demo-video-generator/types/finalDemo').DemoWorkflowState
        completed: boolean
        waitingForUser: boolean
      }>
    },
  }))

  return () => {
    cleanupFns.splice(0).reverse().forEach((cleanup) => cleanup())
    initialized = false
  }
}

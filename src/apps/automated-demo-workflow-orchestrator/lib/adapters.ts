import { registerWorkflowAdapter } from './adapterRegistry'
import type {
  DemoWorkflowStageId,
  WorkflowAdapterContext,
  WorkflowAdapterResult,
  WorkflowStageAdapter,
} from '../types/workflow'

export interface DemoWorkflowCapabilitySet {
  analyze?: (context: WorkflowAdapterContext) => Promise<WorkflowAdapterResult>
  snapshot?: (context: WorkflowAdapterContext) => Promise<WorkflowAdapterResult>
  buildFlow?: (context: WorkflowAdapterContext) => Promise<WorkflowAdapterResult>
  prepareAssets?: (context: WorkflowAdapterContext) => Promise<WorkflowAdapterResult>
  simulate?: (context: WorkflowAdapterContext) => Promise<WorkflowAdapterResult>
  capture?: (context: WorkflowAdapterContext) => Promise<WorkflowAdapterResult>
  processVideo?: (context: WorkflowAdapterContext) => Promise<WorkflowAdapterResult>
}

const STAGES: Array<{
  stage: DemoWorkflowStageId
  appId: string
  key: keyof DemoWorkflowCapabilitySet
}> = [
  { stage: 'analyze', appId: 'website-structure-feature-analyzer', key: 'analyze' },
  { stage: 'snapshot', appId: 'web-page-snapshot-local-simulation', key: 'snapshot' },
  { stage: 'build-flow', appId: 'rule-based-demo-flow-builder', key: 'buildFlow' },
  { stage: 'prepare-assets', appId: 'smart-asset-to-action-mapper', key: 'prepareAssets' },
  { stage: 'simulate', appId: 'web-interaction-simulation-engine', key: 'simulate' },
  { stage: 'capture', appId: 'visual-capture-demo-fallback-engine', key: 'capture' },
  { stage: 'process-video', appId: 'browser-video-processing-studio', key: 'processVideo' },
]

export function registerDemoWorkflowCapabilities(capabilities: DemoWorkflowCapabilitySet): () => void {
  const unregister: Array<() => void> = []

  for (const item of STAGES) {
    const fn = capabilities[item.key]
    if (!fn) continue

    const adapter: WorkflowStageAdapter = {
      appId: item.appId,
      stage: item.stage,
      execute: fn,
    }
    unregister.push(registerWorkflowAdapter(adapter))
  }

  return () => unregister.forEach((fn) => fn())
}

export const DEMO_WORKFLOW_APP_DEPENDENCIES = STAGES.map(({ stage, appId }) => ({ stage, appId }))

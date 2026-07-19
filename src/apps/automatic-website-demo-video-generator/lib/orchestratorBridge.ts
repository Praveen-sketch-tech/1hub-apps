import type {
  DemoWorkflowState,
  DemoWorkflowStrategy,
  FinalDemoGeneratorAdapter,
  FinalDemoVideoResult,
} from '../types/finalDemo'

let adapter: FinalDemoGeneratorAdapter | null = null

export function registerFinalDemoOrchestratorAdapter(next: FinalDemoGeneratorAdapter): () => void {
  if (next.appId !== 'automated-demo-workflow-orchestrator') {
    throw new Error('Final demo generator must use App #026 orchestrator adapter.')
  }
  adapter = next
  return () => {
    if (adapter === next) adapter = null
  }
}

export function getFinalDemoOrchestratorAdapter() {
  return adapter
}

export function createFallbackWorkflowState(
  url: string,
  preferredStrategy?: DemoWorkflowStrategy,
): DemoWorkflowState {
  const timestamp = new Date().toISOString()
  const jobId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `demo-${Date.now()}`

  const stages: DemoWorkflowState['stages'] = [
    ['analyze', 'Analyze website/page'],
    ['choose-mode', 'Choose execution strategy'],
    ['snapshot', 'Prepare snapshot/local simulation'],
    ['build-flow', 'Build demo flow'],
    ['prepare-assets', 'Prepare demo assets'],
    ['simulate', 'Run or simulate interactions'],
    ['capture', 'Capture or record demo'],
    ['process-video', 'Process final video'],
    ['complete', 'Complete workflow'],
  ].map(([id, label]) => ({
    id: id as DemoWorkflowState['stages'][number]['id'],
    label,
    status: 'pending',
    attempts: 0,
  }))

  return {
    version: 1,
    job: {
      version: 1,
      id: jobId,
      url,
      preferredStrategy,
      maxRetries: 1,
    },
    status: 'idle',
    strategy: preferredStrategy,
    stages,
    outputs: {},
    warnings: [
      'App #026 orchestrator adapter is not registered in this runtime yet.',
      'This shell does not fake execution; register the real App #026 adapter to run the end-to-end workflow.',
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function createFinalDemoWorkflow(
  url: string,
  preferredStrategy?: DemoWorkflowStrategy,
): DemoWorkflowState {
  return adapter
    ? adapter.createJob({ url, preferredStrategy })
    : createFallbackWorkflowState(url, preferredStrategy)
}

export async function runFinalDemoWorkflow(
  state: DemoWorkflowState,
  onUpdate?: (state: DemoWorkflowState) => void,
) {
  if (!adapter) {
    return {
      state: {
        ...state,
        status: 'waiting-user' as const,
        warnings: [
          ...state.warnings,
          'Execution paused because App #026 orchestrator adapter is unavailable.',
        ],
        updatedAt: new Date().toISOString(),
      },
      completed: false,
      waitingForUser: true,
    }
  }

  const captureStage = state.stages.find((stage) => stage.id === 'capture')
  const continuingFromCaptureCheckpoint = captureStage?.status === 'waiting-user'

  return adapter.run(state, {
    onUpdate,
    stopBeforePermissionStage: !continuingFromCaptureCheckpoint,
  })
}

export function extractFinalVideoResult(state: DemoWorkflowState): FinalDemoVideoResult | null {
  const value = state.outputs.processedVideo as Partial<FinalDemoVideoResult> | undefined
  if (!value?.blob || !(value.blob instanceof Blob)) return null

  return {
    blob: value.blob,
    mimeType: value.mimeType || value.blob.type || 'video/webm',
    fileName: value.fileName || 'website-demo-video.webm',
    durationMs: value.durationMs,
    width: value.width,
    height: value.height,
  }
}

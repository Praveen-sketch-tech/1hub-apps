import { getWorkflowAdapter } from './adapterRegistry'
import type {
  DemoWorkflowJob,
  DemoWorkflowStageId,
  DemoWorkflowStageState,
  DemoWorkflowState,
  DemoWorkflowStrategy,
  WorkflowRunOptions,
  WorkflowRunResult,
} from '../types/workflow'

const ORDER: DemoWorkflowStageId[] = [
  'analyze',
  'choose-mode',
  'snapshot',
  'build-flow',
  'prepare-assets',
  'simulate',
  'capture',
  'process-video',
  'complete',
]

const LABELS: Record<DemoWorkflowStageId, string> = {
  analyze: 'Analyze website/page',
  'choose-mode': 'Choose execution strategy',
  snapshot: 'Prepare snapshot/local simulation',
  'build-flow': 'Build demo flow',
  'prepare-assets': 'Prepare demo assets',
  simulate: 'Run or simulate interactions',
  capture: 'Capture or record demo',
  'process-video': 'Process final video',
  complete: 'Complete workflow',
}

const OUTPUT_KEYS: Partial<Record<DemoWorkflowStageId, string>> = {
  analyze: 'pageMap',
  snapshot: 'snapshot',
  'build-flow': 'demoFlow',
  'prepare-assets': 'assetMapping',
  simulate: 'simulationResult',
  capture: 'captureResult',
  'process-video': 'processedVideo',
}

const now = () => new Date().toISOString()

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `demo-job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export function createDemoWorkflowJob(input: Partial<DemoWorkflowJob> = {}): DemoWorkflowJob {
  return {
    version: 1,
    id: input.id || uid(),
    url: input.url,
    title: input.title,
    preferredStrategy: input.preferredStrategy,
    maxRetries: input.maxRetries ?? 1,
    metadata: input.metadata,
  }
}

export function createInitialWorkflowState(job: DemoWorkflowJob): DemoWorkflowState {
  const timestamp = now()
  return {
    version: 1,
    job,
    status: 'idle',
    strategy: job.preferredStrategy,
    stages: ORDER.map((id) => ({
      id,
      label: LABELS[id],
      status: 'pending',
      attempts: 0,
      outputKey: OUTPUT_KEYS[id],
    })),
    outputs: {},
    warnings: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function cloneState(state: DemoWorkflowState): DemoWorkflowState {
  return {
    ...state,
    job: { ...state.job },
    stages: state.stages.map((stage) => ({ ...stage })),
    outputs: { ...state.outputs },
    warnings: [...state.warnings],
  }
}

function updateStage(
  state: DemoWorkflowState,
  id: DemoWorkflowStageId,
  patch: Partial<DemoWorkflowStageState>,
) {
  const next = cloneState(state)
  next.stages = next.stages.map((stage) => stage.id === id ? { ...stage, ...patch } : stage)
  next.currentStage = id
  next.updatedAt = now()
  return next
}

function emit(state: DemoWorkflowState, options?: WorkflowRunOptions) {
  options?.onUpdate?.(cloneState(state))
}

function shouldSkip(stage: DemoWorkflowStageId, strategy?: DemoWorkflowStrategy) {
  if (stage === 'snapshot' && strategy === 'direct-accessible') return true
  return false
}

function permissionSensitive(stage: DemoWorkflowStageId, _strategy?: DemoWorkflowStrategy) {
  return stage === 'capture'
}

async function chooseStrategy(state: DemoWorkflowState): Promise<DemoWorkflowStrategy> {
  if (state.job.preferredStrategy) return state.job.preferredStrategy

  const analysis = state.outputs.pageMap as
    | { access?: { mode?: string; directDomAccess?: boolean; sourceAvailable?: boolean } }
    | undefined

  if (analysis?.access?.directDomAccess || analysis?.access?.mode === 'url-fetch-accessible') {
    return 'direct-accessible'
  }

  if (analysis?.access?.sourceAvailable) return 'snapshot-local-simulation'
  return 'visual-capture-fallback'
}

export async function runDemoWorkflow(
  initialState: DemoWorkflowState,
  options?: WorkflowRunOptions,
): Promise<WorkflowRunResult> {
  let state = cloneState(initialState)
  state.status = 'running'
  state.updatedAt = now()
  emit(state, options)

  const maxRetries = Math.max(0, state.job.maxRetries ?? 1)

  for (const stageId of ORDER) {
    const existingStage = state.stages.find((stage) => stage.id === stageId)
    if (existingStage?.status === 'completed' || existingStage?.status === 'skipped') {
      continue
    }
    if (stageId === 'choose-mode') {
      state = updateStage(state, stageId, {
        status: 'running',
        attempts: 1,
        startedAt: now(),
        message: 'Selecting the safest available workflow strategy.',
      })
      emit(state, options)

      state.strategy = await chooseStrategy(state)
      state = updateStage(state, stageId, {
        status: 'completed',
        endedAt: now(),
        message: `Selected ${state.strategy}.`,
      })
      emit(state, options)
      continue
    }

    if (stageId === 'complete') {
      state = updateStage(state, stageId, {
        status: 'completed',
        attempts: 1,
        startedAt: now(),
        endedAt: now(),
        message: 'Workflow completed.',
      })
      state.status = 'completed'
      state.currentStage = 'complete'
      emit(state, options)
      return { state, completed: true, waitingForUser: false }
    }

    if (shouldSkip(stageId, state.strategy)) {
      state = updateStage(state, stageId, {
        status: 'skipped',
        message: `Skipped for ${state.strategy} strategy.`,
      })
      emit(state, options)
      continue
    }

    if (permissionSensitive(stageId, state.strategy) && options?.stopBeforePermissionStage) {
      state = updateStage(state, stageId, {
        status: 'waiting-user',
        message: 'User interaction is required to grant browser capture permission.',
      })
      state.status = 'waiting-user'
      emit(state, options)
      return { state, completed: false, waitingForUser: true }
    }

    const adapter = getWorkflowAdapter(stageId)
    if (!adapter) {
      state = updateStage(state, stageId, {
        status: 'waiting-user',
        message: `No reusable adapter is registered for ${LABELS[stageId]}.`,
      })
      state.status = 'waiting-user'
      state.warnings = [
        ...state.warnings,
        `Stage ${stageId} is waiting for its existing app capability adapter.`,
      ]
      emit(state, options)
      return { state, completed: false, waitingForUser: true }
    }

    let success = false
    let lastError = ''

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      state = updateStage(state, stageId, {
        status: 'running',
        attempts: attempt,
        startedAt: state.stages.find((s) => s.id === stageId)?.startedAt || now(),
        error: undefined,
        message: `Running through ${adapter.appId}.`,
      })
      emit(state, options)

      try {
        const previousIndex = ORDER.indexOf(stageId) - 1
        const previousStage = previousIndex >= 0 ? ORDER[previousIndex] : undefined
        const previousOutputKey = previousStage ? OUTPUT_KEYS[previousStage] : undefined
        const input = previousOutputKey ? state.outputs[previousOutputKey] : undefined

        const result = await adapter.execute({ job: state.job, state: cloneState(state), input })

        if (result.suggestedStrategy) state.strategy = result.suggestedStrategy

        if (result.requiresUser) {
          state = updateStage(state, stageId, {
            status: 'waiting-user',
            message: result.message || 'User interaction is required.',
          })
          state.status = 'waiting-user'
          emit(state, options)
          return { state, completed: false, waitingForUser: true }
        }

        const outputKey = OUTPUT_KEYS[stageId]
        if (outputKey && result.output !== undefined) {
          state.outputs[outputKey] = result.output
        }

        state = updateStage(state, stageId, {
          status: 'completed',
          endedAt: now(),
          message: result.message || `Completed through ${adapter.appId}.`,
        })
        emit(state, options)
        success = true
        break
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown workflow error.'
        state = updateStage(state, stageId, {
          status: attempt <= maxRetries ? 'running' : 'failed',
          error: lastError,
          message: attempt <= maxRetries ? `Retrying after error: ${lastError}` : lastError,
        })
        emit(state, options)
      }
    }

    if (!success) {
      state.status = 'failed'
      state.warnings = [...state.warnings, `Stage ${stageId} failed: ${lastError}`]
      emit(state, options)
      return { state, completed: false, waitingForUser: false }
    }
  }

  return { state, completed: state.status === 'completed', waitingForUser: state.status === 'waiting-user' }
}

export function resumeDemoWorkflow(state: DemoWorkflowState): Promise<WorkflowRunResult> {
  const next = cloneState(state)
  next.status = 'running'

  const firstIncomplete = next.stages.findIndex((stage) =>
    stage.status === 'pending' || stage.status === 'waiting-user' || stage.status === 'failed',
  )

  if (firstIncomplete > 0) {
    next.stages = next.stages.map((stage, index) =>
      index < firstIncomplete ? stage : {
        ...stage,
        status: stage.status === 'completed' || stage.status === 'skipped' ? stage.status : 'pending',
        error: undefined,
      },
    )
  }

  return runDemoWorkflow(next)
}

export function exportWorkflowState(state: DemoWorkflowState): Blob {
  return new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
}

export function parseWorkflowState(text: string): DemoWorkflowState {
  const value = JSON.parse(text) as DemoWorkflowState
  if (
    value.version !== 1 ||
    !value.job ||
    !Array.isArray(value.stages) ||
    typeof value.outputs !== 'object'
  ) {
    throw new Error('Invalid App #026 workflow-state JSON.')
  }
  return value
}

export type DemoWorkflowStageId =
  | 'analyze'
  | 'choose-mode'
  | 'snapshot'
  | 'build-flow'
  | 'prepare-assets'
  | 'simulate'
  | 'capture'
  | 'process-video'
  | 'complete'

export type DemoWorkflowStrategy =
  | 'direct-accessible'
  | 'snapshot-local-simulation'
  | 'visual-capture-fallback'

export type DemoWorkflowStatus =
  | 'idle'
  | 'running'
  | 'waiting-user'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type DemoWorkflowStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'skipped'
  | 'waiting-user'
  | 'failed'

export interface DemoWorkflowJob {
  version: 1
  id: string
  url?: string
  title?: string
  preferredStrategy?: DemoWorkflowStrategy
  maxRetries?: number
  metadata?: Record<string, unknown>
}

export interface DemoWorkflowStageState {
  id: DemoWorkflowStageId
  label: string
  status: DemoWorkflowStageStatus
  attempts: number
  startedAt?: string
  endedAt?: string
  message?: string
  error?: string
  outputKey?: string
}

export interface DemoWorkflowState {
  version: 1
  job: DemoWorkflowJob
  status: DemoWorkflowStatus
  strategy?: DemoWorkflowStrategy
  currentStage?: DemoWorkflowStageId
  stages: DemoWorkflowStageState[]
  outputs: Record<string, unknown>
  warnings: string[]
  createdAt: string
  updatedAt: string
}

export interface WorkflowAdapterContext {
  job: DemoWorkflowJob
  state: DemoWorkflowState
  input?: unknown
}

export interface WorkflowAdapterResult {
  output?: unknown
  message?: string
  requiresUser?: boolean
  suggestedStrategy?: DemoWorkflowStrategy
}

export interface WorkflowStageAdapter {
  appId: string
  stage: DemoWorkflowStageId
  execute(context: WorkflowAdapterContext): Promise<WorkflowAdapterResult>
}

export interface WorkflowRunOptions {
  onUpdate?: (state: DemoWorkflowState) => void
  stopBeforePermissionStage?: boolean
}

export interface WorkflowRunResult {
  state: DemoWorkflowState
  completed: boolean
  waitingForUser: boolean
}

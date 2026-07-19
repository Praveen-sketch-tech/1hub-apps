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

export interface DemoWorkflowStageState {
  id: DemoWorkflowStageId
  label: string
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'waiting-user' | 'failed'
  attempts: number
  message?: string
  error?: string
}

export interface DemoWorkflowState {
  version: 1
  job: {
    version: 1
    id: string
    url?: string
    title?: string
    preferredStrategy?: DemoWorkflowStrategy
    maxRetries?: number
    metadata?: Record<string, unknown>
  }
  status: DemoWorkflowStatus
  strategy?: DemoWorkflowStrategy
  currentStage?: DemoWorkflowStageId
  stages: DemoWorkflowStageState[]
  outputs: Record<string, unknown>
  warnings: string[]
  createdAt: string
  updatedAt: string
}

export interface FinalDemoVideoResult {
  blob: Blob
  mimeType: string
  fileName: string
  durationMs?: number
  width?: number
  height?: number
}

export interface FinalDemoGeneratorAdapter {
  appId: 'automated-demo-workflow-orchestrator'
  createJob(input: {
    url: string
    preferredStrategy?: DemoWorkflowStrategy
  }): DemoWorkflowState
  run(
    state: DemoWorkflowState,
    options?: { onUpdate?: (state: DemoWorkflowState) => void; stopBeforePermissionStage?: boolean },
  ): Promise<{ state: DemoWorkflowState; completed: boolean; waitingForUser: boolean }>
}

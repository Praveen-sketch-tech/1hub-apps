export type DemoActionType =
  | 'move'
  | 'click'
  | 'doubleClick'
  | 'type'
  | 'scroll'
  | 'select'
  | 'upload'
  | 'drag'
  | 'drop'
  | 'focus'
  | 'highlight'
  | 'zoom'
  | 'wait'

export interface DemoPoint {
  x: number
  y: number
}

export interface DemoActionBase {
  id: string
  type: DemoActionType
  label?: string
  durationMs?: number
  delayAfterMs?: number
}

export type DemoAction =
  | (DemoActionBase & { type: 'move'; targetId?: string; point?: DemoPoint })
  | (DemoActionBase & { type: 'click' | 'doubleClick'; targetId?: string; point?: DemoPoint })
  | (DemoActionBase & { type: 'type'; targetId: string; text: string; intervalMs?: number; clearFirst?: boolean })
  | (DemoActionBase & { type: 'scroll'; targetId?: string; x?: number; y: number })
  | (DemoActionBase & { type: 'select'; targetId: string; value: string })
  | (DemoActionBase & { type: 'upload'; targetId: string; fileName: string; fileType?: string })
  | (DemoActionBase & { type: 'drag'; targetId: string; toTargetId?: string; toPoint?: DemoPoint })
  | (DemoActionBase & { type: 'drop'; targetId?: string; point?: DemoPoint })
  | (DemoActionBase & { type: 'focus' | 'highlight'; targetId: string; durationMs?: number })
  | (DemoActionBase & { type: 'zoom'; targetId?: string; point?: DemoPoint; scale: number; durationMs?: number })
  | (DemoActionBase & { type: 'wait'; durationMs: number })

export interface DemoSequence {
  version: 1
  id: string
  name: string
  description?: string
  actions: DemoAction[]
  defaults?: {
    actionDurationMs?: number
    delayAfterMs?: number
    typingIntervalMs?: number
  }
}

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error'

export interface SimulationProgress {
  status: SimulationStatus
  actionIndex: number
  totalActions: number
  currentAction?: DemoAction
  message?: string
}

export interface SimulationResult {
  status: Exclude<SimulationStatus, 'idle' | 'running' | 'paused'>
  completedActions: number
  totalActions: number
  startedAt: number
  endedAt: number
  error?: string
}

export interface SimulationSurface {
  resolveTarget(targetId: string): HTMLElement | null
  getCursor(): HTMLElement
  getViewport(): HTMLElement
  setStepLabel(text: string): void
  setUploadLabel(targetId: string, fileName: string): void
}

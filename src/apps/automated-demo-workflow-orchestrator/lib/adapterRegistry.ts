import type { DemoWorkflowStageId, WorkflowStageAdapter } from '../types/workflow'

const adapters = new Map<DemoWorkflowStageId, WorkflowStageAdapter>()

export function registerWorkflowAdapter(adapter: WorkflowStageAdapter): () => void {
  adapters.set(adapter.stage, adapter)
  return () => {
    if (adapters.get(adapter.stage) === adapter) adapters.delete(adapter.stage)
  }
}

export function getWorkflowAdapter(stage: DemoWorkflowStageId): WorkflowStageAdapter | undefined {
  return adapters.get(stage)
}

export function listRegisteredWorkflowAdapters(): WorkflowStageAdapter[] {
  return [...adapters.values()]
}

export function clearWorkflowAdapters() {
  adapters.clear()
}

export type AnalysisAccessMode =
  | 'pasted-html'
  | 'local-file'
  | 'same-origin-document'
  | 'url-fetch-accessible'
  | 'cross-origin-unavailable'
  | 'snapshot-ready'
  | 'visual-capture-fallback'

export type FeatureKind =
  | 'heading'
  | 'button'
  | 'link'
  | 'form'
  | 'input'
  | 'textarea'
  | 'select'
  | 'tab'
  | 'file-upload'
  | 'download'
  | 'primary-cta'
  | 'section'
  | 'label'

export interface FeatureNode {
  id: string
  kind: FeatureKind
  label: string
  selectorHint?: string
  tagName?: string
  inputType?: string
  href?: string
  formId?: string
  disabled?: boolean
  required?: boolean
  confidence?: number
  attributes?: Record<string, string>
}

export interface WorkflowHint {
  id: string
  label: string
  role: 'input' | 'configure' | 'process' | 'preview' | 'download' | 'navigation' | 'unknown'
  featureIds: string[]
  confidence: number
}

export interface PageFeatureMap {
  version: 1
  generatedAt: string
  source: {
    title?: string
    url?: string
    origin?: string
    mode: AnalysisAccessMode
  }
  access: {
    mode: AnalysisAccessMode
    directDomAccess: boolean
    sourceAvailable: boolean
    reason?: string
    nextBestMode?: 'paste-html' | 'snapshot-local-simulation' | 'visual-capture'
  }
  summary: Record<string, number>
  features: FeatureNode[]
  workflowHints: WorkflowHint[]
  repeatedLabels: Array<{ label: string; count: number }>
  notes: string[]
}

export type DemoStepRole =
  | 'input'
  | 'configure'
  | 'process'
  | 'preview'
  | 'download'
  | 'navigation'
  | 'manual'

export interface DemoStep {
  id: string
  role: DemoStepRole
  label: string
  caption: string
  enabled: boolean
  waitAfterMs: number
  featureIds: string[]
  confidence: number
  manual?: boolean
}

export interface AssetRequirement {
  id: string
  stepId: string
  featureId: string
  label: string
  inputType: 'file'
  accept?: string
  suggestedAssetKind:
    | 'image'
    | 'pdf'
    | 'spreadsheet'
    | 'document'
    | 'audio'
    | 'video'
    | 'qr-image'
    | 'barcode-image'
    | 'generic-file'
}

export interface DemoFlow {
  version: 1
  id: string
  name: string
  description?: string
  sourceTitle?: string
  sourceUrl?: string
  generatedAt: string
  generationMode: 'rules' | 'manual-fallback' | 'imported'
  isPrimary: boolean
  steps: DemoStep[]
  assetRequirements: AssetRequirement[]
  warnings: string[]
}

export interface DemoFlowCollection {
  version: 1
  sourceTitle?: string
  sourceUrl?: string
  generatedAt: string
  primaryFlowId: string
  flows: DemoFlow[]
}

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

export interface DemoFlowValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export type AnalysisAccessMode =
  | 'pasted-html'
  | 'local-file'
  | 'same-origin-document'
  | 'url-fetch-accessible'
  | 'cross-origin-unavailable'
  | 'snapshot-ready'
  | 'visual-capture-fallback'

export type FeatureKind =
  | 'heading' | 'button' | 'link' | 'form' | 'input' | 'textarea' | 'select'
  | 'tab' | 'file-upload' | 'download' | 'primary-cta' | 'section' | 'label'

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

export interface AnalysisAccess {
  mode: AnalysisAccessMode
  directDomAccess: boolean
  sourceAvailable: boolean
  reason?: string
  nextBestMode?: 'paste-html' | 'snapshot-local-simulation' | 'visual-capture'
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
  access: AnalysisAccess
  summary: {
    headings: number
    buttons: number
    links: number
    forms: number
    inputs: number
    textareas: number
    selects: number
    tabs: number
    fileUploads: number
    downloads: number
    primaryCtas: number
    sections: number
  }
  features: FeatureNode[]
  workflowHints: WorkflowHint[]
  repeatedLabels: Array<{ label: string; count: number }>
  notes: string[]
}

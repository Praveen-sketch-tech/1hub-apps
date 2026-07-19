export type SnapshotAccessMode =
  | 'user-html'
  | 'html-file'
  | 'accessible-html'
  | 'page-map'
  | 'imported-project'

export type SnapshotFallbackMode =
  | 'none'
  | 'source-required'
  | 'snapshot-required'
  | 'visual-capture-required'

export interface SnapshotSourceMetadata {
  sourceUrl?: string
  title?: string
  capturedAt: string
  accessMode: SnapshotAccessMode
  notes?: string
}

export interface SnapshotPageMapElement {
  id?: string
  type?: string
  tag?: string
  label?: string
  text?: string
  name?: string
  href?: string
  inputType?: string
  selector?: string
  role?: string
  options?: string[]
}

export interface SnapshotPageMap {
  title?: string
  url?: string
  sourceUrl?: string
  headings?: Array<string | SnapshotPageMapElement>
  buttons?: Array<string | SnapshotPageMapElement>
  links?: Array<string | SnapshotPageMapElement>
  inputs?: SnapshotPageMapElement[]
  textareas?: SnapshotPageMapElement[]
  selects?: SnapshotPageMapElement[]
  tabs?: Array<string | SnapshotPageMapElement>
  forms?: Array<{
    id?: string
    label?: string
    controls?: SnapshotPageMapElement[]
  }>
  fileUploads?: SnapshotPageMapElement[]
  downloadControls?: Array<string | SnapshotPageMapElement>
  primaryCta?: string | SnapshotPageMapElement | null
  featureLabels?: string[]
  workflowHints?: string[]
  [key: string]: unknown
}

export interface SnapshotProject {
  version: 1
  id: string
  name: string
  createdAt: string
  updatedAt: string
  metadata: SnapshotSourceMetadata
  sanitizedHtml: string
  pageMap?: SnapshotPageMap
  fallbackMode: SnapshotFallbackMode
  warnings: string[]
}

export interface CreateSnapshotInput {
  name?: string
  html?: string
  sourceUrl?: string
  title?: string
  accessMode?: SnapshotAccessMode
  pageMap?: SnapshotPageMap
  notes?: string
}

export interface SnapshotCapabilityResult {
  indexedDb: boolean
  blobUrl: boolean
  opfs: boolean
}

export interface SnapshotProjectSummary {
  id: string
  name: string
  sourceUrl?: string
  updatedAt: string
  accessMode: SnapshotAccessMode
}

export interface SimulationTargetDescriptor {
  projectId: string
  kind: 'local-snapshot'
  html: string
  sourceUrl?: string
  pageMap?: SnapshotPageMap
}

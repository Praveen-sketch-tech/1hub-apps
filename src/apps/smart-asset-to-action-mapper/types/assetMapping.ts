export type SuggestedAssetKind =
  | 'image'
  | 'pdf'
  | 'spreadsheet'
  | 'document'
  | 'audio'
  | 'video'
  | 'qr-image'
  | 'barcode-image'
  | 'generic-file'

export interface AssetRequirement {
  id: string
  stepId: string
  featureId: string
  label: string
  inputType: 'file'
  accept?: string
  suggestedAssetKind: SuggestedAssetKind
}

export interface DemoStep {
  id: string
  role: string
  label: string
  caption: string
  enabled: boolean
  waitAfterMs: number
  featureIds: string[]
  confidence: number
  manual?: boolean
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

export type AssetFactoryCapability =
  | 'generate-image'
  | 'generate-ocr-image'
  | 'generate-scanned-pdf'
  | 'generate-pdf'
  | 'generate-spreadsheet'
  | 'generate-document'
  | 'generate-audio'
  | 'generate-video'
  | 'generate-qr-image'
  | 'generate-barcode-image'
  | 'generate-generic-file'

export interface AssetGenerationRequest {
  id: string
  requirementId: string
  capability: AssetFactoryCapability
  requestedKind: SuggestedAssetKind
  preferredMimeTypes: string[]
  suggestedFileName: string
  reason: string
  providerAppId: 'universal-test-asset-factory'
}

export interface GeneratedAsset {
  id: string
  name: string
  mimeType: string
  blob: Blob
  source: 'app-017' | 'user-provided'
  capability?: AssetFactoryCapability
}

export interface SerializedAssetDescriptor {
  id: string
  name: string
  mimeType: string
  source: 'app-017' | 'user-provided' | 'pending-generation'
  capability?: AssetFactoryCapability
}

export interface AssetActionMapping {
  id: string
  requirement: AssetRequirement
  generationRequest: AssetGenerationRequest
  asset?: SerializedAssetDescriptor
  status: 'pending-generation' | 'mapped' | 'unsupported'
  uploadAction: {
    type: 'upload'
    targetId: string
    fileName: string
    fileType?: string
    label: string
  }
  notes: string[]
}

export interface AssetMappingPlan {
  version: 1
  id: string
  generatedAt: string
  flowId: string
  flowName: string
  mappings: AssetActionMapping[]
  warnings: string[]
}

export interface AssetFactoryAdapter {
  providerAppId: 'universal-test-asset-factory'
  supports(capability: AssetFactoryCapability): boolean
  generate(request: AssetGenerationRequest): Promise<GeneratedAsset>
}

export interface ExecuteMappingResult {
  plan: AssetMappingPlan
  assets: GeneratedAsset[]
}

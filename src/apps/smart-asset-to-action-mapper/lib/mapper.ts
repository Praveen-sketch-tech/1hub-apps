import type {
  AssetActionMapping,
  AssetFactoryCapability,
  AssetGenerationRequest,
  AssetMappingPlan,
  AssetRequirement,
  DemoFlow,
  DemoFlowCollection,
  SuggestedAssetKind,
} from '../types/assetMapping'

const uid = (prefix: string) =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const normalize = (value?: string) => (value || '').trim().toLowerCase()

function capabilityFor(requirement: AssetRequirement): AssetFactoryCapability {
  const label = normalize(requirement.label)
  const accept = normalize(requirement.accept)

  if (label.includes('ocr') || label.includes('scan') || label.includes('text image')) {
    return accept.includes('pdf') ? 'generate-scanned-pdf' : 'generate-ocr-image'
  }
  if (label.includes('qr')) return 'generate-qr-image'
  if (label.includes('barcode')) return 'generate-barcode-image'

  switch (requirement.suggestedAssetKind) {
    case 'image': return 'generate-image'
    case 'pdf': return label.includes('scan') ? 'generate-scanned-pdf' : 'generate-pdf'
    case 'spreadsheet': return 'generate-spreadsheet'
    case 'document': return 'generate-document'
    case 'audio': return 'generate-audio'
    case 'video': return 'generate-video'
    case 'qr-image': return 'generate-qr-image'
    case 'barcode-image': return 'generate-barcode-image'
    default: return 'generate-generic-file'
  }
}

function mimeTypesFor(kind: SuggestedAssetKind, accept?: string): string[] {
  if (accept?.trim()) {
    return accept.split(',').map((value) => value.trim()).filter(Boolean)
  }
  switch (kind) {
    case 'image': return ['image/png', 'image/jpeg']
    case 'pdf': return ['application/pdf']
    case 'spreadsheet': return ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    case 'document': return ['text/plain', 'application/pdf']
    case 'audio': return ['audio/webm', 'audio/wav']
    case 'video': return ['video/webm']
    case 'qr-image':
    case 'barcode-image': return ['image/png']
    default: return ['application/octet-stream']
  }
}

function extensionFor(kind: SuggestedAssetKind): string {
  switch (kind) {
    case 'image':
    case 'qr-image':
    case 'barcode-image': return 'png'
    case 'pdf': return 'pdf'
    case 'spreadsheet': return 'csv'
    case 'document': return 'txt'
    case 'audio': return 'wav'
    case 'video': return 'webm'
    default: return 'bin'
  }
}

export function createGenerationRequest(requirement: AssetRequirement): AssetGenerationRequest {
  const capability = capabilityFor(requirement)
  return {
    id: uid('asset-request'),
    requirementId: requirement.id,
    capability,
    requestedKind: requirement.suggestedAssetKind,
    preferredMimeTypes: mimeTypesFor(requirement.suggestedAssetKind, requirement.accept),
    suggestedFileName: `demo-${requirement.suggestedAssetKind}.${extensionFor(requirement.suggestedAssetKind)}`,
    reason: `Required by demo step ${requirement.stepId}: ${requirement.label}`,
    providerAppId: 'universal-test-asset-factory',
  }
}

export function mapRequirementToAction(requirement: AssetRequirement): AssetActionMapping {
  const generationRequest = createGenerationRequest(requirement)
  return {
    id: uid('mapping'),
    requirement,
    generationRequest,
    status: 'pending-generation',
    uploadAction: {
      type: 'upload',
      targetId: requirement.featureId,
      fileName: generationRequest.suggestedFileName,
      fileType: generationRequest.preferredMimeTypes[0],
      label: `Upload ${requirement.label}`,
    },
    notes: [
      'Generation is delegated to App #017 Universal Test Asset Factory through a registered reusable adapter.',
      'No asset-generation implementation is duplicated inside App #024.',
    ],
  }
}

export function buildAssetMappingPlan(flow: DemoFlow): AssetMappingPlan {
  const mappings = flow.assetRequirements.map(mapRequirementToAction)
  const warnings: string[] = []

  if (!mappings.length) {
    warnings.push('This flow has no file-input asset requirements.')
  }

  return {
    version: 1,
    id: uid('mapping-plan'),
    generatedAt: new Date().toISOString(),
    flowId: flow.id,
    flowName: flow.name,
    mappings,
    warnings,
  }
}

export function getPrimaryFlow(collection: DemoFlowCollection): DemoFlow {
  const flow =
    collection.flows.find((item) => item.id === collection.primaryFlowId) ??
    collection.flows.find((item) => item.isPrimary) ??
    collection.flows[0]

  if (!flow) throw new Error('Demo Flow collection contains no flows.')
  return flow
}

export function buildAssetMappingPlanFromCollection(collection: DemoFlowCollection): AssetMappingPlan {
  return buildAssetMappingPlan(getPrimaryFlow(collection))
}

export function parseDemoFlowCollection(text: string): DemoFlowCollection {
  const value = JSON.parse(text) as DemoFlowCollection
  if (
    value.version !== 1 ||
    !Array.isArray(value.flows) ||
    !value.flows.length ||
    typeof value.primaryFlowId !== 'string'
  ) {
    throw new Error('Invalid App #023 Demo Flow collection JSON.')
  }
  return value
}

export function exportAssetMappingPlan(plan: AssetMappingPlan): Blob {
  return new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
}

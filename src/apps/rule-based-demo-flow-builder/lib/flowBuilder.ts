import type {
  AssetRequirement,
  DemoFlow,
  DemoFlowCollection,
  DemoStep,
  DemoStepRole,
  FeatureNode,
  PageFeatureMap,
} from '../types/demoFlow'

const uid = (prefix = 'flow') =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const roleOrder: DemoStepRole[] = [
  'navigation',
  'input',
  'configure',
  'process',
  'preview',
  'download',
  'manual',
]

const normalize = (value: string) => value.trim().toLowerCase()

const processWords = [
  'process', 'generate', 'create', 'convert', 'compress', 'resize', 'scan',
  'analyze', 'calculate', 'submit', 'run', 'start', 'apply', 'merge', 'split',
  'extract', 'enhance', 'transform', 'encode', 'decode', 'crop', 'export',
]

const previewWords = ['preview', 'result', 'output', 'view', 'show', 'display']
const downloadWords = ['download', 'save', 'export']
const configureWords = ['quality', 'width', 'height', 'size', 'format', 'option', 'mode', 'ratio', 'resolution']

function textMatches(label: string, words: string[]) {
  const value = normalize(label)
  return words.some((word) => value.includes(word))
}

function roleForFeature(feature: FeatureNode): DemoStepRole {
  if (feature.kind === 'file-upload') return 'input'
  if (feature.kind === 'input' || feature.kind === 'textarea' || feature.kind === 'select') return 'configure'
  if (feature.kind === 'download' || textMatches(feature.label, downloadWords)) return 'download'
  if (feature.kind === 'primary-cta' || textMatches(feature.label, processWords)) return 'process'
  if (textMatches(feature.label, previewWords)) return 'preview'
  if (feature.kind === 'tab' || feature.kind === 'link') return 'navigation'
  return 'manual'
}

function captionFor(role: DemoStepRole, label: string) {
  const clean = label || 'this step'
  switch (role) {
    case 'input': return `Provide the required input using ${clean}.`
    case 'configure': return `Configure ${clean}.`
    case 'process': return `Run ${clean}.`
    case 'preview': return `Review ${clean}.`
    case 'download': return `Download or save the final result with ${clean}.`
    case 'navigation': return `Open ${clean}.`
    default: return clean
  }
}

function defaultWait(role: DemoStepRole) {
  if (role === 'process') return 1200
  if (role === 'preview') return 700
  if (role === 'download') return 350
  return 250
}

function toStep(role: DemoStepRole, features: FeatureNode[], label?: string): DemoStep {
  const best = [...features].sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))[0]
  const stepLabel = label || best?.label || role
  return {
    id: uid('step'),
    role,
    label: stepLabel,
    caption: captionFor(role, stepLabel),
    enabled: true,
    waitAfterMs: defaultWait(role),
    featureIds: features.map((feature) => feature.id),
    confidence: best?.confidence ?? 0.55,
  }
}

function assetKind(feature: FeatureNode): AssetRequirement['suggestedAssetKind'] {
  const accept = normalize(feature.attributes?.accept || '')
  const label = normalize(feature.label)
  if (accept.includes('image') || /\.(png|jpe?g|webp|gif)/.test(accept) || label.includes('image')) return 'image'
  if (accept.includes('pdf') || label.includes('pdf')) return 'pdf'
  if (accept.includes('sheet') || accept.includes('csv') || accept.includes('excel') || label.includes('spreadsheet') || label.includes('csv')) return 'spreadsheet'
  if (accept.includes('audio') || label.includes('audio')) return 'audio'
  if (accept.includes('video') || label.includes('video')) return 'video'
  if (label.includes('qr')) return 'qr-image'
  if (label.includes('barcode')) return 'barcode-image'
  if (accept.includes('document') || accept.includes('word') || label.includes('document')) return 'document'
  return 'generic-file'
}

export function extractAssetRequirements(flow: DemoFlow, map: PageFeatureMap): AssetRequirement[] {
  const stepByFeature = new Map<string, string>()
  flow.steps.forEach((step) => step.featureIds.forEach((id) => stepByFeature.set(id, step.id)))

  return map.features
    .filter((feature) => feature.kind === 'file-upload' || feature.inputType === 'file')
    .map((feature) => ({
      id: uid('asset'),
      stepId: stepByFeature.get(feature.id) || flow.steps[0]?.id || '',
      featureId: feature.id,
      label: feature.label || 'File upload',
      inputType: 'file' as const,
      accept: feature.attributes?.accept,
      suggestedAssetKind: assetKind(feature),
    }))
}

function buildRoleBuckets(map: PageFeatureMap) {
  const buckets = new Map<DemoStepRole, FeatureNode[]>()
  roleOrder.forEach((role) => buckets.set(role, []))

  map.workflowHints.forEach((hint) => {
    const role = hint.role === 'unknown' ? 'manual' : hint.role
    const features = hint.featureIds
      .map((id) => map.features.find((feature) => feature.id === id))
      .filter((feature): feature is FeatureNode => !!feature)
    if (features.length) buckets.get(role)?.push(...features)
  })

  map.features.forEach((feature) => {
    const role = roleForFeature(feature)
    const bucket = buckets.get(role)
    if (bucket && !bucket.some((item) => item.id === feature.id)) bucket.push(feature)
  })

  return buckets
}

function buildPrimarySteps(map: PageFeatureMap): DemoStep[] {
  const buckets = buildRoleBuckets(map)
  const steps: DemoStep[] = []

  const inputFeatures = buckets.get('input') || []
  if (inputFeatures.length) steps.push(toStep('input', inputFeatures, inputFeatures[0].label || 'Provide input'))

  const configureFeatures = (buckets.get('configure') || []).filter(
    (feature) => feature.kind !== 'file-upload' && feature.inputType !== 'file',
  )
  if (configureFeatures.length) steps.push(toStep('configure', configureFeatures, 'Configure options'))

  const processFeatures = buckets.get('process') || []
  if (processFeatures.length) steps.push(toStep('process', processFeatures, processFeatures[0].label || 'Process'))

  const previewFeatures = buckets.get('preview') || []
  if (previewFeatures.length) steps.push(toStep('preview', previewFeatures, previewFeatures[0].label || 'Preview result'))

  const downloadFeatures = buckets.get('download') || []
  if (downloadFeatures.length) steps.push(toStep('download', downloadFeatures, downloadFeatures[0].label || 'Download result'))

  return steps
}

function buildAlternativeFlow(map: PageFeatureMap, primary: DemoFlow): DemoFlow | null {
  const tabs = map.features.filter((feature) => feature.kind === 'tab')
  if (!tabs.length) return null

  const tab = tabs[0]
  return {
    ...primary,
    id: uid('flow'),
    name: `${primary.name} — ${tab.label || 'Alternate tab'}`,
    description: `Alternative deterministic flow beginning with the detected tab "${tab.label}".`,
    isPrimary: false,
    steps: [
      toStep('navigation', [tab], tab.label || 'Open alternate tab'),
      ...primary.steps.map((step) => ({ ...step, id: uid('step') })),
    ],
    assetRequirements: [],
  }
}

export function buildDemoFlows(map: PageFeatureMap): DemoFlowCollection {
  const warnings: string[] = []
  let steps = buildPrimarySteps(map)
  let generationMode: DemoFlow['generationMode'] = 'rules'

  if (!steps.length) {
    generationMode = 'manual-fallback'
    warnings.push('Insufficient structured page information to generate a reliable workflow. A manual editable step was created instead.')
    steps = [{
      id: uid('step'),
      role: 'manual',
      label: 'Define demo step',
      caption: 'Add or edit this step using verified page information.',
      enabled: true,
      waitAfterMs: 500,
      featureIds: [],
      confidence: 0,
      manual: true,
    }]
  }

  const title = map.source.title || 'Detected Page'
  const primary: DemoFlow = {
    version: 1,
    id: uid('flow'),
    name: `${title} — Primary Demo Flow`,
    description: 'Deterministically generated from Page Map / Feature Map data.',
    sourceTitle: map.source.title,
    sourceUrl: map.source.url,
    generatedAt: new Date().toISOString(),
    generationMode,
    isPrimary: true,
    steps,
    assetRequirements: [],
    warnings,
  }
  primary.assetRequirements = extractAssetRequirements(primary, map)

  const flows = [primary]
  const alternate = buildAlternativeFlow(map, primary)
  if (alternate) {
    alternate.assetRequirements = extractAssetRequirements(alternate, map)
    flows.push(alternate)
  }

  return {
    version: 1,
    sourceTitle: map.source.title,
    sourceUrl: map.source.url,
    generatedAt: new Date().toISOString(),
    primaryFlowId: primary.id,
    flows,
  }
}

export function createManualFlow(name = 'Manual Demo Flow'): DemoFlow {
  return {
    version: 1,
    id: uid('flow'),
    name,
    generatedAt: new Date().toISOString(),
    generationMode: 'manual-fallback',
    isPrimary: true,
    steps: [{
      id: uid('step'),
      role: 'manual',
      label: 'Define demo step',
      caption: 'Describe the verified interaction to demonstrate.',
      enabled: true,
      waitAfterMs: 500,
      featureIds: [],
      confidence: 0,
      manual: true,
    }],
    assetRequirements: [],
    warnings: ['Manual flow: verify each step against the real page or local simulation before capture.'],
  }
}

export function reorderSteps(flow: DemoFlow, fromIndex: number, toIndex: number): DemoFlow {
  const steps = [...flow.steps]
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= steps.length || toIndex >= steps.length) return flow
  const [item] = steps.splice(fromIndex, 1)
  steps.splice(toIndex, 0, item)
  return { ...flow, steps }
}

export function setPrimaryFlow(collection: DemoFlowCollection, flowId: string): DemoFlowCollection {
  if (!collection.flows.some((flow) => flow.id === flowId)) return collection
  return {
    ...collection,
    primaryFlowId: flowId,
    flows: collection.flows.map((flow) => ({ ...flow, isPrimary: flow.id === flowId })),
  }
}

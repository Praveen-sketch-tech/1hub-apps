import type { DemoFlow, DemoFlowCollection, DemoFlowValidation } from '../types/demoFlow'

export function validateDemoFlow(flow: DemoFlow): DemoFlowValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (flow.version !== 1) errors.push('Flow version must be 1.')
  if (!flow.id) errors.push('Flow id is required.')
  if (!flow.name.trim()) errors.push('Flow name is required.')
  if (!Array.isArray(flow.steps) || !flow.steps.length) errors.push('At least one demo step is required.')

  const ids = new Set<string>()
  flow.steps.forEach((step, index) => {
    if (!step.id) errors.push(`Step ${index + 1}: id is required.`)
    if (ids.has(step.id)) errors.push(`Step ${index + 1}: duplicate step id.`)
    ids.add(step.id)
    if (!step.label.trim()) errors.push(`Step ${index + 1}: label is required.`)
    if (step.waitAfterMs < 0) errors.push(`Step ${index + 1}: waitAfterMs cannot be negative.`)
    if (step.manual) warnings.push(`Step ${index + 1} is manual and should be verified before execution.`)
  })

  if (!flow.steps.some((step) => step.enabled)) warnings.push('All steps are disabled.')
  if (flow.generationMode === 'manual-fallback') warnings.push('This flow uses manual fallback because structured page data was insufficient.')

  return { valid: errors.length === 0, errors, warnings }
}

export function validateDemoFlowCollection(collection: DemoFlowCollection): DemoFlowValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (collection.version !== 1) errors.push('Collection version must be 1.')
  if (!collection.flows.length) errors.push('At least one flow is required.')
  if (!collection.flows.some((flow) => flow.id === collection.primaryFlowId)) errors.push('primaryFlowId must reference an existing flow.')

  collection.flows.forEach((flow, index) => {
    const result = validateDemoFlow(flow)
    result.errors.forEach((error) => errors.push(`Flow ${index + 1}: ${error}`))
    result.warnings.forEach((warning) => warnings.push(`Flow ${index + 1}: ${warning}`))
  })

  return { valid: errors.length === 0, errors, warnings }
}

export function parsePageFeatureMap(text: string) {
  const value = JSON.parse(text) as Partial<import('../types/demoFlow').PageFeatureMap>
  if (value.version !== 1 || !value.source || !Array.isArray(value.features) || !Array.isArray(value.workflowHints)) {
    throw new Error('Invalid App #021 Page Map / Feature Map JSON.')
  }
  return value as import('../types/demoFlow').PageFeatureMap
}

export function parseDemoFlowCollection(text: string): DemoFlowCollection {
  const value = JSON.parse(text) as DemoFlowCollection
  const result = validateDemoFlowCollection(value)
  if (!result.valid) throw new Error(result.errors.join(' '))
  return {
    ...value,
    flows: value.flows.map((flow) => ({ ...flow, generationMode: 'imported' })),
  }
}

export function exportDemoFlowCollection(collection: DemoFlowCollection): Blob {
  return new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' })
}

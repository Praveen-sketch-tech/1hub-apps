import type {
  DemoAction,
  DemoFlow,
  DemoSequence,
  FeatureNode,
  PageFeatureMap,
} from '../types/demoFlow'

const actionId = (prefix: string) =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

function primaryFeature(stepFeatureIds: string[], map: PageFeatureMap): FeatureNode | undefined {
  return stepFeatureIds
    .map((id) => map.features.find((feature) => feature.id === id))
    .find(Boolean)
}

function targetId(feature?: FeatureNode) {
  return feature?.id
}

function actionsForStep(
  step: DemoFlow['steps'][number],
  map: PageFeatureMap,
): DemoAction[] {
  if (!step.enabled) return []

  const feature = primaryFeature(step.featureIds, map)
  const target = targetId(feature)
  const actions: DemoAction[] = []

  if (target) {
    actions.push({
      id: actionId('highlight'),
      type: 'highlight',
      targetId: target,
      label: step.caption,
      durationMs: 450,
      delayAfterMs: 80,
    })
  }

  if (step.role === 'input' && target) {
    actions.push({
      id: actionId('upload'),
      type: 'upload',
      targetId: target,
      fileName: 'demo-asset',
      fileType: feature?.attributes?.accept,
      label: step.label,
      delayAfterMs: 150,
    })
  } else if (step.role === 'configure' && target) {
    if (feature?.kind === 'select') {
      actions.push({
        id: actionId('select'),
        type: 'select',
        targetId: target,
        value: feature.attributes?.value || feature.attributes?.defaultValue || 'demo',
        label: step.label,
        delayAfterMs: 150,
      })
    } else {
      actions.push({
        id: actionId('focus'),
        type: 'focus',
        targetId: target,
        label: step.label,
        durationMs: 350,
        delayAfterMs: 100,
      })
      actions.push({
        id: actionId('type'),
        type: 'type',
        targetId: target,
        text: feature?.attributes?.value || feature?.attributes?.placeholder || 'demo',
        intervalMs: 55,
        clearFirst: true,
        label: step.label,
        delayAfterMs: 150,
      })
    }
  } else if ((step.role === 'process' || step.role === 'download' || step.role === 'navigation') && target) {
    actions.push({
      id: actionId('click'),
      type: 'click',
      targetId: target,
      label: step.label,
      delayAfterMs: 150,
    })
  } else if (step.role === 'preview' && target) {
    actions.push({
      id: actionId('zoom'),
      type: 'zoom',
      targetId: target,
      scale: 1.15,
      label: step.label,
      durationMs: 500,
      delayAfterMs: 100,
    })
  }

  if (step.waitAfterMs > 0) {
    actions.push({
      id: actionId('wait'),
      type: 'wait',
      durationMs: step.waitAfterMs,
      label: `Wait after ${step.label}`,
    })
  }

  return actions
}

export function convertFlowToDemoSequence(flow: DemoFlow, map: PageFeatureMap): DemoSequence {
  return {
    version: 1,
    id: actionId('sequence'),
    name: flow.name,
    description: flow.description,
    actions: flow.steps.flatMap((step) => actionsForStep(step, map)),
    defaults: {
      actionDurationMs: 650,
      delayAfterMs: 180,
      typingIntervalMs: 55,
    },
  }
}

export function exportDemoSequence(sequence: DemoSequence): Blob {
  return new Blob([JSON.stringify(sequence, null, 2)], { type: 'application/json' })
}

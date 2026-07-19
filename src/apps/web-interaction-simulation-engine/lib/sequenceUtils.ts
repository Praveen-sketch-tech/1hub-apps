import type { DemoAction, DemoActionType, DemoSequence } from '../types/demoActions'

export const ACTION_TYPES: DemoActionType[] = [
  'move', 'click', 'doubleClick', 'type', 'scroll', 'select', 'upload',
  'drag', 'drop', 'focus', 'highlight', 'zoom', 'wait',
]

export function createActionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `action-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createSequence(name = 'Demo interaction sequence'): DemoSequence {
  return {
    version: 1,
    id: createActionId(),
    name,
    actions: [],
    defaults: { actionDurationMs: 650, delayAfterMs: 180, typingIntervalMs: 55 },
  }
}

export function cloneSequence(sequence: DemoSequence): DemoSequence {
  return JSON.parse(JSON.stringify(sequence)) as DemoSequence
}

export function validateSequence(value: unknown): { valid: boolean; errors: string[]; sequence?: DemoSequence } {
  const errors: string[] = []
  if (!value || typeof value !== 'object') return { valid: false, errors: ['Sequence must be an object.'] }
  const sequence = value as Partial<DemoSequence>
  if (sequence.version !== 1) errors.push('version must be 1.')
  if (!sequence.id || typeof sequence.id !== 'string') errors.push('id must be a non-empty string.')
  if (!sequence.name || typeof sequence.name !== 'string') errors.push('name must be a non-empty string.')
  if (!Array.isArray(sequence.actions)) errors.push('actions must be an array.')
  else sequence.actions.forEach((action, index) => {
    if (!action || typeof action !== 'object') { errors.push(`Action ${index + 1} must be an object.`); return }
    const candidate = action as Partial<DemoAction>
    if (!candidate.id || typeof candidate.id !== 'string') errors.push(`Action ${index + 1}: id is required.`)
    if (!candidate.type || !ACTION_TYPES.includes(candidate.type)) errors.push(`Action ${index + 1}: unsupported type.`)
    if ('durationMs' in candidate && typeof candidate.durationMs === 'number' && candidate.durationMs < 0) errors.push(`Action ${index + 1}: durationMs cannot be negative.`)
  })
  return errors.length ? { valid: false, errors } : { valid: true, errors: [], sequence: sequence as DemoSequence }
}

export function parseSequenceJson(text: string) {
  try {
    const parsed = JSON.parse(text) as unknown
    return validateSequence(parsed)
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : 'Invalid JSON.'] }
  }
}

export function sequenceSummary(sequence: DemoSequence) {
  const counts = new Map<string, number>()
  sequence.actions.forEach((action) => counts.set(action.type, (counts.get(action.type) ?? 0) + 1))
  const detail = [...counts.entries()].map(([type, count]) => `${type}: ${count}`).join(', ')
  return `${sequence.name} has ${sequence.actions.length} action${sequence.actions.length === 1 ? '' : 's'}${detail ? ` (${detail})` : ''}.`
}

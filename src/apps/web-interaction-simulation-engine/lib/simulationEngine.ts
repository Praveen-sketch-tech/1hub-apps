import type {
  DemoAction,
  DemoPoint,
  DemoSequence,
  SimulationProgress,
  SimulationResult,
  SimulationSurface,
} from '../types/demoActions'
import { validateSequence } from './sequenceUtils'

export interface SimulationControllerOptions {
  onProgress?: (progress: SimulationProgress) => void
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (ms <= 0) { resolve(); return }
  const timer = window.setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }, { once: true })
})

function targetCenter(surface: SimulationSurface, targetId?: string, point?: DemoPoint): DemoPoint {
  if (point) return point
  if (!targetId) return { x: 24, y: 24 }
  const target = surface.resolveTarget(targetId)
  if (!target) throw new Error(`Target "${targetId}" was not found on the simulation surface.`)
  const viewportRect = surface.getViewport().getBoundingClientRect()
  const rect = target.getBoundingClientRect()
  return { x: rect.left - viewportRect.left + rect.width / 2, y: rect.top - viewportRect.top + rect.height / 2 }
}

async function moveCursor(surface: SimulationSurface, point: DemoPoint, durationMs: number) {
  const cursor = surface.getCursor()
  const currentX = Number(cursor.dataset.x ?? 24)
  const currentY = Number(cursor.dataset.y ?? 24)
  await cursor.animate([
    { transform: `translate(${currentX}px, ${currentY}px)` },
    { transform: `translate(${point.x}px, ${point.y}px)` },
  ], { duration: durationMs, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }).finished
  cursor.dataset.x = String(point.x)
  cursor.dataset.y = String(point.y)
}

async function pulse(surface: SimulationSurface, targetId: string | undefined, className: string, durationMs: number) {
  if (!targetId) return
  const target = surface.resolveTarget(targetId)
  if (!target) throw new Error(`Target "${targetId}" was not found.`)
  target.classList.add(className)
  await sleep(durationMs)
  target.classList.remove(className)
}

async function typeInto(target: HTMLElement, text: string, intervalMs: number, clearFirst: boolean, signal?: AbortSignal) {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) throw new Error('Type action target must be an input or textarea.')
  target.focus()
  if (clearFirst) target.value = ''
  for (const char of text) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    target.value += char
    target.dispatchEvent(new Event('input', { bubbles: true }))
    await sleep(intervalMs, signal)
  }
  target.dispatchEvent(new Event('change', { bubbles: true }))
}

async function executeAction(action: DemoAction, sequence: DemoSequence, surface: SimulationSurface, signal?: AbortSignal) {
  const duration = action.durationMs ?? sequence.defaults?.actionDurationMs ?? 650
  const typingInterval = sequence.defaults?.typingIntervalMs ?? 55
  surface.setStepLabel(action.label || action.type)

  switch (action.type) {
    case 'move':
      await moveCursor(surface, targetCenter(surface, action.targetId, action.point), duration)
      break
    case 'click':
    case 'doubleClick': {
      await moveCursor(surface, targetCenter(surface, action.targetId, action.point), Math.min(duration, 500))
      const cursor = surface.getCursor()
      cursor.classList.add('wis-cursor-clicking')
      if (action.targetId) surface.resolveTarget(action.targetId)?.dispatchEvent(new MouseEvent(action.type === 'click' ? 'click' : 'dblclick', { bubbles: true }))
      await sleep(action.type === 'doubleClick' ? 280 : 180, signal)
      cursor.classList.remove('wis-cursor-clicking')
      break
    }
    case 'type': {
      const target = surface.resolveTarget(action.targetId)
      if (!target) throw new Error(`Target "${action.targetId}" was not found.`)
      await moveCursor(surface, targetCenter(surface, action.targetId), Math.min(duration, 450))
      await typeInto(target, action.text, action.intervalMs ?? typingInterval, action.clearFirst ?? false, signal)
      break
    }
    case 'scroll': {
      const target = action.targetId ? surface.resolveTarget(action.targetId) : surface.getViewport()
      if (!target) throw new Error(`Target "${action.targetId}" was not found.`)
      target.scrollTo({ left: action.x ?? 0, top: action.y, behavior: 'smooth' })
      await sleep(duration, signal)
      break
    }
    case 'select': {
      const target = surface.resolveTarget(action.targetId)
      if (!(target instanceof HTMLSelectElement)) throw new Error('Select action target must be a select element.')
      await moveCursor(surface, targetCenter(surface, action.targetId), Math.min(duration, 450))
      target.value = action.value
      target.dispatchEvent(new Event('change', { bubbles: true }))
      await pulse(surface, action.targetId, 'wis-target-active', 350)
      break
    }
    case 'upload':
      await moveCursor(surface, targetCenter(surface, action.targetId), Math.min(duration, 450))
      surface.setUploadLabel(action.targetId, action.fileName)
      await pulse(surface, action.targetId, 'wis-target-active', 500)
      break
    case 'drag': {
      const from = targetCenter(surface, action.targetId)
      const to = targetCenter(surface, action.toTargetId, action.toPoint)
      await moveCursor(surface, from, 250)
      surface.resolveTarget(action.targetId)?.classList.add('wis-dragging')
      await moveCursor(surface, to, duration)
      surface.resolveTarget(action.targetId)?.classList.remove('wis-dragging')
      break
    }
    case 'drop':
      await moveCursor(surface, targetCenter(surface, action.targetId, action.point), Math.min(duration, 350))
      if (action.targetId) await pulse(surface, action.targetId, 'wis-drop-active', 650)
      break
    case 'focus':
      surface.resolveTarget(action.targetId)?.focus()
      await pulse(surface, action.targetId, 'wis-focus-active', duration)
      break
    case 'highlight':
      await pulse(surface, action.targetId, 'wis-highlight-active', duration)
      break
    case 'zoom': {
      const viewport = surface.getViewport()
      const point = targetCenter(surface, action.targetId, action.point)
      viewport.style.transformOrigin = `${point.x}px ${point.y}px`
      await viewport.animate([{ transform: 'scale(1)' }, { transform: `scale(${Math.max(.5, Math.min(action.scale, 2.5))})` }, { transform: 'scale(1)' }], { duration, easing: 'ease-in-out' }).finished
      break
    }
    case 'wait':
      await sleep(action.durationMs, signal)
      break
  }
}

export class SimulationController {
  private abortController: AbortController | null = null
  private paused = false
  private resumeResolvers: Array<() => void> = []

  constructor(private readonly options: SimulationControllerOptions = {}) {}

  pause() { this.paused = true }
  resume() { this.paused = false; this.resumeResolvers.splice(0).forEach((resolve) => resolve()) }
  cancel() { this.abortController?.abort(); this.resume() }

  private async waitWhilePaused() {
    if (!this.paused) return
    await new Promise<void>((resolve) => this.resumeResolvers.push(resolve))
  }

  async run(sequence: DemoSequence, surface: SimulationSurface): Promise<SimulationResult> {
    const validation = validateSequence(sequence)
    if (!validation.valid) throw new Error(validation.errors.join(' '))
    this.abortController = new AbortController()
    const startedAt = Date.now()
    let completedActions = 0
    try {
      this.options.onProgress?.({ status: 'running', actionIndex: 0, totalActions: sequence.actions.length })
      for (let i = 0; i < sequence.actions.length; i += 1) {
        await this.waitWhilePaused()
        if (this.abortController.signal.aborted) throw new DOMException('Cancelled', 'AbortError')
        const action = sequence.actions[i]
        this.options.onProgress?.({ status: this.paused ? 'paused' : 'running', actionIndex: i, totalActions: sequence.actions.length, currentAction: action, message: action.label || action.type })
        await executeAction(action, sequence, surface, this.abortController.signal)
        completedActions += 1
        await sleep(action.delayAfterMs ?? sequence.defaults?.delayAfterMs ?? 180, this.abortController.signal)
      }
      surface.setStepLabel('Simulation complete')
      this.options.onProgress?.({ status: 'completed', actionIndex: sequence.actions.length, totalActions: sequence.actions.length, message: 'Simulation complete' })
      return { status: 'completed', completedActions, totalActions: sequence.actions.length, startedAt, endedAt: Date.now() }
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'AbortError'
      const message = cancelled ? 'Simulation cancelled.' : error instanceof Error ? error.message : 'Simulation failed.'
      this.options.onProgress?.({ status: cancelled ? 'cancelled' : 'error', actionIndex: completedActions, totalActions: sequence.actions.length, message })
      return { status: cancelled ? 'cancelled' : 'error', completedActions, totalActions: sequence.actions.length, startedAt, endedAt: Date.now(), error: cancelled ? undefined : message }
    } finally {
      this.abortController = null
      this.paused = false
      this.resumeResolvers = []
    }
  }
}

export async function simulateDemoSequence(sequence: DemoSequence, surface: SimulationSurface, options?: SimulationControllerOptions) {
  return new SimulationController(options).run(sequence, surface)
}

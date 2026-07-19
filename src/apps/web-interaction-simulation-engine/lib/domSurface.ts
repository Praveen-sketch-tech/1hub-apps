import type { SimulationSurface } from '../types/demoActions'

export function createDomSimulationSurface(root: HTMLElement): SimulationSurface {
  const getCursor = () => {
    const cursor = root.querySelector<HTMLElement>('[data-sim-cursor]')
    if (!cursor) throw new Error('Simulation cursor element is missing.')
    return cursor
  }

  return {
    resolveTarget(targetId) {
      const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(targetId) : targetId.replace(/["\\]/g, '\\$&')
      return root.querySelector<HTMLElement>(`[data-sim-id="${escaped}"]`)
    },
    getCursor,
    getViewport() {
      const viewport = root.querySelector<HTMLElement>('[data-sim-viewport]')
      if (!viewport) throw new Error('Simulation viewport element is missing.')
      return viewport
    },
    setStepLabel(text) {
      const label = root.querySelector<HTMLElement>('[data-sim-step-label]')
      if (label) label.textContent = text
    },
    setUploadLabel(targetId, fileName) {
      const target = this.resolveTarget(targetId)
      const label = target?.querySelector<HTMLElement>('[data-upload-name]')
      if (label) label.textContent = fileName
      target?.setAttribute('data-has-upload', 'true')
    },
  }
}

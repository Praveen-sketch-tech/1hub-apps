// Lazy, idempotent bootstrap for the automated demo-video runtime.
// Loaded only when App #026 or #027 is opened, so the pipeline does not
// increase the main application bundle for users who never use these apps.
let wiring: Promise<void> | null = null

export function ensureDemoWorkflowWiringLoaded(): Promise<void> {
  if (!wiring) {
    wiring = import('@core/runtime/demoRuntime').then((mod) => {
      mod.initializeDemoRuntime()
    })
  }
  return wiring
}

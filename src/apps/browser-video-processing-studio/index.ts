export { BrowserVideoProcessingStudioPage } from './BrowserVideoProcessingStudioPage'
export { chatModule } from './chatActions'
export { inspectVideo } from './lib/inspectVideo'
export { processEditPlan } from './lib/editPlanProcessor'
export { exportVideo } from './lib/exportVideo'
export {
  createDefaultEditPlan,
  createSource,
  getPlanDuration,
  mutePlan,
  resizePlan,
  trimPlan,
  validateEditPlan,
} from './lib/videoProcessing'
export type {
  ProcessedVideoResult,
  VideoEditPlan,
  VideoMetadata,
  VideoOverlay,
  VideoEffect,
} from './types/videoEditPlan'

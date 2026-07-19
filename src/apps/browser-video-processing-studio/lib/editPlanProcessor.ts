import { exportVideo } from './exportVideo'
import type { ProcessedVideoResult, VideoEditPlan } from '../types/videoEditPlan'

export async function processEditPlan(plan: VideoEditPlan): Promise<ProcessedVideoResult> {
  return exportVideo(plan)
}

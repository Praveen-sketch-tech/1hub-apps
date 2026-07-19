import type { VideoEditPlan, VideoSourceRef } from '../types/videoEditPlan'

export function createSource(file: File | Blob, id = crypto.randomUUID()): VideoSourceRef {
  return {
    id,
    file,
    name: file instanceof File ? file.name : 'video',
    mimeType: file.type,
  }
}

export function createDefaultEditPlan(source: VideoSourceRef, duration: number, width: number, height: number): VideoEditPlan {
  return {
    version: 1,
    sources: [source],
    clips: [
      {
        id: crypto.randomUUID(),
        sourceId: source.id,
        sourceStart: 0,
        sourceEnd: duration,
        transform: {
          rotation: 0,
          fit: 'contain',
          background: '#000000',
        },
      },
    ],
    output: {
      width: width || 1280,
      height: height || 720,
      aspectRatio: 'original',
      frameRate: 30,
    },
    overlays: [],
    effects: [],
    audio: {
      muted: false,
      volume: 1,
      preserveSourceAudio: true,
    },
    export: {
      fileName: 'processed-video.webm',
    },
  }
}

export function getPlanDuration(plan: VideoEditPlan): number {
  return plan.clips.reduce((total, clip) => total + Math.max(0, clip.sourceEnd - clip.sourceStart), 0)
}

export function validateEditPlan(plan: VideoEditPlan): string[] {
  const errors: string[] = []
  if (plan.version !== 1) errors.push('Unsupported edit-plan version.')
  if (!plan.sources.length) errors.push('At least one source video is required.')
  if (!plan.clips.length) errors.push('At least one clip is required.')
  if (plan.output.width <= 0 || plan.output.height <= 0) errors.push('Output dimensions must be positive.')
  for (const clip of plan.clips) {
    if (!plan.sources.some((source) => source.id === clip.sourceId)) errors.push(`Missing source for clip ${clip.id}.`)
    if (clip.sourceEnd <= clip.sourceStart) errors.push(`Clip ${clip.id} has an invalid time range.`)
  }
  return errors
}

export function trimPlan(plan: VideoEditPlan, start: number, end: number): VideoEditPlan {
  const first = plan.clips[0]
  if (!first) return plan
  return {
    ...plan,
    clips: [
      {
        ...first,
        sourceStart: Math.max(first.sourceStart, start),
        sourceEnd: Math.min(first.sourceEnd, end),
      },
    ],
  }
}

export function mutePlan(plan: VideoEditPlan): VideoEditPlan {
  return {
    ...plan,
    audio: {
      ...plan.audio,
      muted: true,
      volume: 0,
    },
  }
}

export function resizePlan(plan: VideoEditPlan, width: number, height: number): VideoEditPlan {
  return {
    ...plan,
    output: {
      ...plan.output,
      width,
      height,
    },
  }
}

export type DemoActionType =
  | 'move' | 'click' | 'doubleClick' | 'type' | 'scroll' | 'select'
  | 'upload' | 'drag' | 'drop' | 'focus' | 'highlight' | 'zoom' | 'wait'

export interface DemoPoint { x:number; y:number }

export interface DemoActionBase {
  id:string
  type:DemoActionType
  label?:string
  durationMs?:number
  delayAfterMs?:number
}

export type DemoAction =
  | (DemoActionBase & { type:'move'; targetId?:string; point?:DemoPoint })
  | (DemoActionBase & { type:'click'|'doubleClick'; targetId?:string; point?:DemoPoint })
  | (DemoActionBase & { type:'type'; targetId:string; text:string; intervalMs?:number; clearFirst?:boolean })
  | (DemoActionBase & { type:'scroll'; targetId?:string; x?:number; y:number })
  | (DemoActionBase & { type:'select'; targetId:string; value:string })
  | (DemoActionBase & { type:'upload'; targetId:string; fileName:string; fileType?:string })
  | (DemoActionBase & { type:'drag'; targetId:string; toTargetId?:string; toPoint?:DemoPoint })
  | (DemoActionBase & { type:'drop'; targetId?:string; point?:DemoPoint })
  | (DemoActionBase & { type:'focus'|'highlight'; targetId:string; durationMs?:number })
  | (DemoActionBase & { type:'zoom'; targetId?:string; point?:DemoPoint; scale:number; durationMs?:number })
  | (DemoActionBase & { type:'wait'; durationMs:number })

export interface DemoSequence {
  version:1
  id:string
  name:string
  description?:string
  actions:DemoAction[]
  defaults?:{ actionDurationMs?:number; delayAfterMs?:number; typingIntervalMs?:number }
}

export interface VisualCue {
  id:string
  type:'cursor'|'click'|'focus'|'highlight'|'zoom'|'caption'|'scroll'
  startMs:number
  durationMs:number
  point?:DemoPoint
  region?:{ x:number; y:number; width:number; height:number }
  scale?:number
  text?:string
  targetId?:string
}

export interface VisualCapturePlan {
  version:1
  id:string
  name:string
  sourceSequenceId?:string
  createdAt:string
  cues:VisualCue[]
  truthfulness:{
    source:'user-visible-capture'|'local-simulation'|'user-defined'
    requiresUserPermission:boolean
    note:string
  }
}

export interface CaptureCapability {
  displayCapture:boolean
  mediaRecorder:boolean
  canvasCapture:boolean
  supportedMimeTypes:string[]
}

export interface VisualCaptureResult {
  blob:Blob
  mimeType:string
  fileName:string
  durationMs:number
  width:number
  height:number
}

export interface RecorderAdapter {
  providerAppId:'local-screen-tab-recorder'
  start():Promise<MediaStream>
  stop?():Promise<void>|void
}

import type { DemoAction, DemoSequence, VisualCapturePlan, VisualCue } from '../types/visualCapture'

const uid=(p:string)=>typeof crypto!=='undefined'&&'randomUUID'in crypto?crypto.randomUUID():`${p}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`

function actionDuration(action:DemoAction, defaults?:DemoSequence['defaults']){
  if(action.type==='wait') return action.durationMs
  return action.durationMs ?? defaults?.actionDurationMs ?? 650
}

export function sequenceToVisualCapturePlan(sequence:DemoSequence):VisualCapturePlan{
  let cursor=0
  const cues:VisualCue[]=[]
  for(const action of sequence.actions){
    const duration=actionDuration(action,sequence.defaults)
    const label=action.label || action.type
    if(action.type==='move'){
      cues.push({id:uid('cue'),type:'cursor',startMs:cursor,durationMs:duration,point:action.point,targetId:action.targetId,text:label})
    } else if(action.type==='click'||action.type==='doubleClick'){
      cues.push({id:uid('cue'),type:'click',startMs:cursor,durationMs:Math.max(350,duration),point:action.point,targetId:action.targetId,text:label})
    } else if(action.type==='focus'){
      cues.push({id:uid('cue'),type:'focus',startMs:cursor,durationMs:duration,targetId:action.targetId,text:label})
    } else if(action.type==='highlight'){
      cues.push({id:uid('cue'),type:'highlight',startMs:cursor,durationMs:duration,targetId:action.targetId,text:label})
    } else if(action.type==='zoom'){
      cues.push({id:uid('cue'),type:'zoom',startMs:cursor,durationMs:duration,targetId:action.targetId,point:action.point,scale:action.scale,text:label})
    } else if(action.type==='scroll'){
      cues.push({id:uid('cue'),type:'scroll',startMs:cursor,durationMs:duration,targetId:action.targetId,text:label})
    }
    if(action.type!=='wait'){
      cues.push({id:uid('cue'),type:'caption',startMs:cursor,durationMs:duration,text:label})
    }
    cursor += duration + (action.delayAfterMs ?? sequence.defaults?.delayAfterMs ?? 180)
  }
  return {
    version:1,id:uid('capture-plan'),name:`${sequence.name} — Visual Capture Plan`,
    sourceSequenceId:sequence.id,createdAt:new Date().toISOString(),cues,
    truthfulness:{
      source:'user-visible-capture',requiresUserPermission:true,
      note:'Visual cues decorate only user-visible or user-defined workflows. They do not claim hidden or unverified functionality.'
    }
  }
}

export function parseDemoSequence(text:string):DemoSequence{
  const value=JSON.parse(text) as DemoSequence
  if(value.version!==1||!value.id||!value.name||!Array.isArray(value.actions)) throw new Error('Invalid App #020 DemoSequence JSON.')
  return value
}

export function exportVisualCapturePlan(plan:VisualCapturePlan){
  return new Blob([JSON.stringify(plan,null,2)],{type:'application/json'})
}

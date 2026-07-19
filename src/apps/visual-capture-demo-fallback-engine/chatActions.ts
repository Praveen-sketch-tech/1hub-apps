import type { AppChatModule } from '@core/chat/types'
import { exportVisualCapturePlan, parseDemoSequence, sequenceToVisualCapturePlan } from './lib/plan'

const APP_ID='visual-capture-demo-fallback-engine'
const isJson=(file:File)=>file.type==='application/json'||/\.json$/i.test(file.name||'')

export const chatModule:AppChatModule={
  appId:APP_ID,
  actions:[{
    id:'prepare-visual-capture-plan',
    appId:APP_ID,
    label:'Prepare visual capture fallback plan',
    description:'Convert an attached App #020 DemoSequence into a truthful visual capture plan with cursor, click, focus, zoom and caption cues. Actual screen capture still requires user permission in the app UI.',
    keywords:['visual capture','fallback plan','demo capture','cursor cues','click cues'],
    requiresFile:true,
    accepts:['application/json','.json'],
    canHandle:({input,file})=>!!file&&isJson(file)&&/(visual capture|fallback plan|demo capture|cursor|click cues)/i.test(input),
    execute:async({file})=>{
      if(!file||!isJson(file)) return {text:'Attach an App #020 DemoSequence JSON file.'}
      try{
        const plan=sequenceToVisualCapturePlan(parseDemoSequence(await file.text()))
        return {
          text:`Prepared a visual capture fallback plan with ${plan.cues.length} timed cues. Screen/tab capture is not started by chat because browser permission must be granted interactively by the user.`,
          blob:exportVisualCapturePlan(plan),
          fileName:'visual-capture-fallback-plan.json',
        }
      }catch(error){
        return {text:error instanceof Error?error.message:'Could not prepare the visual capture plan.'}
      }
    }
  }]
}

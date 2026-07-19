import { ChangeEvent, useMemo, useRef, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { captureWithVisualPlan, detectCaptureCapability } from './lib/capture'
import { exportVisualCapturePlan, parseDemoSequence, sequenceToVisualCapturePlan } from './lib/plan'
import type { DemoSequence, VisualCapturePlan, VisualCaptureResult } from './types/visualCapture'
import './VisualCaptureDemoFallbackEngine.css'

const SAMPLE:DemoSequence={
  version:1,id:'sample-sequence',name:'Sample Tool Demo',
  actions:[
    {id:'a1',type:'move',label:'Move to upload area',point:{x:.32,y:.35},durationMs:700},
    {id:'a2',type:'click',label:'Choose a file',point:{x:.32,y:.35},durationMs:500},
    {id:'a3',type:'wait',label:'Wait for preview',durationMs:900},
    {id:'a4',type:'zoom',label:'Review the result',point:{x:.65,y:.55},scale:1.2,durationMs:900},
    {id:'a5',type:'click',label:'Download the result',point:{x:.78,y:.82},durationMs:600},
  ],
  defaults:{actionDurationMs:650,delayAfterMs:180,typingIntervalMs:55}
}

function download(blob:Blob,name:string){
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a');a.href=url;a.download=name;a.click()
  setTimeout(()=>URL.revokeObjectURL(url),0)
}

export function VisualCaptureDemoFallbackEnginePage(){
  const [sequenceText,setSequenceText]=useState(JSON.stringify(SAMPLE,null,2))
  const [plan,setPlan]=useState<VisualCapturePlan>(()=>sequenceToVisualCapturePlan(SAMPLE))
  const [status,setStatus]=useState('Sample sequence loaded. Prepare the plan, then explicitly grant capture permission to record.')
  const [result,setResult]=useState<VisualCaptureResult|null>(null)
  const [busy,setBusy]=useState(false)
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const cap=useMemo(()=>detectCaptureCapability(),[])

  const build=()=>{
    try{
      const sequence=parseDemoSequence(sequenceText)
      const next=sequenceToVisualCapturePlan(sequence)
      setPlan(next);setStatus(`Prepared ${next.cues.length} timed visual cues.`)
    }catch(error){setStatus(error instanceof Error?error.message:'Invalid sequence JSON.')}
  }

  const importJson=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return
    try{
      const text=await file.text();const seq=parseDemoSequence(text)
      setSequenceText(JSON.stringify(seq,null,2));setPlan(sequenceToVisualCapturePlan(seq))
      setStatus(`Loaded ${file.name}.`)
    }catch(error){setStatus(error instanceof Error?error.message:'Could not import sequence.')}
  }

  const start=async()=>{
    const canvas=canvasRef.current
    if(!canvas)return
    setBusy(true);setResult(null)
    try{
      const output=await captureWithVisualPlan(canvas,plan,{onStatus:setStatus})
      setResult(output)
      setStatus('Visual fallback capture completed locally.')
    }catch(error){
      setStatus(error instanceof Error?error.message:'Capture failed.')
    }finally{setBusy(false)}
  }

  return <div className="vc-page">
    <ToolAppHeader
      appNumber="025"
      title="Visual Capture & Demo Fallback Engine"
      description="Create truthful user-permitted visual demo captures with reusable cursor, click, focus, zoom and caption cues when direct page automation is unavailable."
    />

    <section className="vc-notice">
      <strong>Permission and truthfulness:</strong>
      <span>Capture starts only after your browser shows its screen/window/tab picker and you approve it. This fallback decorates only visible or user-defined workflows and does not invent hidden functionality.</span>
    </section>

    <section className="vc-grid vc-grid--top">
      <div className="vc-card">
        <div className="vc-header">
          <div><h2>App #020 DemoSequence</h2><p className="vc-muted">Import structured actions and convert them into timed visual cues.</p></div>
          <label className="vc-file">Import JSON<input type="file" accept=".json,application/json" onChange={importJson}/></label>
        </div>
        <textarea rows={18} value={sequenceText} onChange={e=>setSequenceText(e.target.value)}/>
        <div className="vc-row vc-wrap">
          <button onClick={build}>Build visual capture plan</button>
          <button onClick={()=>download(exportVisualCapturePlan(plan),'visual-capture-fallback-plan.json')}>Export plan</button>
        </div>
      </div>

      <div className="vc-card">
        <h2>Capabilities</h2>
        <div className="vc-stats">
          <span><strong>{cap.displayCapture?'Yes':'No'}</strong> display capture</span>
          <span><strong>{cap.mediaRecorder?'Yes':'No'}</strong> MediaRecorder</span>
          <span><strong>{cap.canvasCapture?'Yes':'No'}</strong> canvas capture</span>
          <span><strong>{plan.cues.length}</strong> visual cues</span>
        </div>
        <p className="vc-muted">Preferred reusable path: App #018 recorder adapter → App #025 visual capture plan → App #019 processing. Standalone mode can use browser getDisplayMedia directly when supported.</p>
        <button disabled={busy||!cap.displayCapture||!cap.mediaRecorder||!cap.canvasCapture} onClick={start}>
          {busy?'Capturing…':'Choose screen/tab and capture'}
        </button>
        {result?<button onClick={()=>download(result.blob,result.fileName)}>Download captured WebM</button>:null}
      </div>
    </section>

    <section className="vc-status">{status}</section>

    <section className="vc-grid">
      <div className="vc-card">
        <h2>Live composited preview</h2>
        <canvas ref={canvasRef} className="vc-canvas"/>
      </div>
      <div className="vc-card">
        <h2>Visual capture plan</h2>
        <pre className="vc-code">{JSON.stringify(plan,null,2)}</pre>
      </div>
    </section>

    <section className="vc-card">
      <h2>Fallback pipeline</h2>
      <div className="vc-pipeline">
        <span>App #023 flow</span><b>→</b><span>App #020 actions</span><b>→</b><span>App #025 visual cues</span><b>→</b><span>App #018/user-permitted capture</span><b>→</b><span>App #019 processing</span>
      </div>
    </section>
  </div>
}

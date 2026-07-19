import type { CaptureCapability, RecorderAdapter, VisualCapturePlan, VisualCaptureResult } from '../types/visualCapture'

let recorderAdapter:RecorderAdapter|null=null

export function registerRecorderAdapter(adapter:RecorderAdapter){
  recorderAdapter=adapter
  return ()=>{ if(recorderAdapter===adapter) recorderAdapter=null }
}

export function detectCaptureCapability():CaptureCapability{
  const candidates=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']
  return {
    displayCapture:typeof navigator!=='undefined'&&!!navigator.mediaDevices?.getDisplayMedia,
    mediaRecorder:typeof MediaRecorder!=='undefined',
    canvasCapture:typeof HTMLCanvasElement!=='undefined'&&'captureStream'in HTMLCanvasElement.prototype,
    supportedMimeTypes:typeof MediaRecorder==='undefined'?[]:candidates.filter(x=>MediaRecorder.isTypeSupported(x)),
  }
}

async function requestCapture():Promise<MediaStream>{
  if(recorderAdapter) return recorderAdapter.start()
  if(!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen/tab capture is not supported in this browser.')
  return navigator.mediaDevices.getDisplayMedia({video:true,audio:true})
}

function chooseMime(){
  const cap=detectCaptureCapability()
  return cap.supportedMimeTypes[0]||'video/webm'
}

export async function captureWithVisualPlan(
  canvas:HTMLCanvasElement,
  plan:VisualCapturePlan,
  options?:{fps?:number; onStatus?:(message:string)=>void}
):Promise<VisualCaptureResult>{
  const source=await requestCapture()
  const video=document.createElement('video')
  video.srcObject=source
  video.muted=true
  await video.play()

  const width=video.videoWidth||1280
  const height=video.videoHeight||720
  canvas.width=width
  canvas.height=height
  const ctx=canvas.getContext('2d')
  if(!ctx) throw new Error('Canvas 2D rendering is unavailable.')

  const fps=options?.fps||30
  const out=canvas.captureStream(fps)
  source.getAudioTracks().forEach(track=>out.addTrack(track))
  const mimeType=chooseMime()
  const chunks:BlobPart[]=[]
  const recorder=new MediaRecorder(out,{mimeType})
  recorder.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data) }

  const endMs=Math.max(1500,...plan.cues.map(c=>c.startMs+c.durationMs))
  const started=performance.now()
  let raf=0

  const render=()=>{
    const t=performance.now()-started
    ctx.clearRect(0,0,width,height)
    ctx.drawImage(video,0,0,width,height)

    for(const cue of plan.cues){
      if(t<cue.startMs||t>cue.startMs+cue.durationMs) continue
      const progress=(t-cue.startMs)/Math.max(1,cue.durationMs)

      if(cue.type==='caption'&&cue.text){
        ctx.save()
        ctx.font=`${Math.max(18,Math.round(width/45))}px system-ui`
        const pad=16
        const metrics=ctx.measureText(cue.text)
        const boxW=Math.min(width-pad*4,metrics.width+pad*2)
        ctx.fillStyle='rgba(0,0,0,.72)'
        ctx.fillRect((width-boxW)/2,height-80,boxW,48)
        ctx.fillStyle='white'
        ctx.textAlign='center'
        ctx.textBaseline='middle'
        ctx.fillText(cue.text,width/2,height-56,boxW-pad)
        ctx.restore()
      }

      const x=(cue.point?.x ?? .5)*width
      const y=(cue.point?.y ?? .5)*height

      if(cue.type==='cursor'){
        ctx.save()
        ctx.beginPath()
        ctx.arc(x,y,10,0,Math.PI*2)
        ctx.fillStyle='rgba(255,255,255,.95)'
        ctx.fill()
        ctx.strokeStyle='rgba(0,0,0,.8)'
        ctx.lineWidth=2
        ctx.stroke()
        ctx.restore()
      }

      if(cue.type==='click'){
        ctx.save()
        ctx.beginPath()
        ctx.arc(x,y,18+progress*26,0,Math.PI*2)
        ctx.strokeStyle=`rgba(255,255,255,${1-progress})`
        ctx.lineWidth=5
        ctx.stroke()
        ctx.restore()
      }

      if((cue.type==='focus'||cue.type==='highlight')&&cue.region){
        ctx.save()
        ctx.strokeStyle='rgba(255,255,255,.95)'
        ctx.lineWidth=5
        ctx.strokeRect(cue.region.x*width,cue.region.y*height,cue.region.width*width,cue.region.height*height)
        ctx.restore()
      }
    }
    if(performance.now()-started<endMs) raf=requestAnimationFrame(render)
  }

  options?.onStatus?.('Recording user-permitted visible capture with visual cues…')
  recorder.start(250)
  render()
  await new Promise(resolve=>setTimeout(resolve,endMs))
  cancelAnimationFrame(raf)
  recorder.stop()
  await new Promise<void>((resolve,reject)=>{
    recorder.onstop=()=>resolve()
    recorder.onerror=()=>reject(new Error('MediaRecorder failed.'))
  })
  source.getTracks().forEach(track=>track.stop())
  await recorderAdapter?.stop?.()

  return {
    blob:new Blob(chunks,{type:mimeType}),
    mimeType,
    fileName:'visual-demo-fallback.webm',
    durationMs:endMs,
    width,height
  }
}

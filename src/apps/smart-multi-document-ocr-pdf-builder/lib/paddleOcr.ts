import { PaddleOCR } from '@paddleocr/paddleocr-js'
import type { OcrLanguage,OcrLine } from './types'
type PaddleInstance=Awaited<ReturnType<typeof PaddleOCR.create>>
const engines=new Map<OcrLanguage,Promise<PaddleInstance>>()
function engineFor(language:OcrLanguage){
  let engine=engines.get(language)
  if(!engine){engine=PaddleOCR.create({lang:language,ocrVersion:'PP-OCRv5',worker:true,ortOptions:{backend:'wasm',wasmPaths:'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/',numThreads:1,simd:true}});engines.set(language,engine)}
  return engine
}
export async function runPaddleOcr(input:Blob|HTMLCanvasElement,language:OcrLanguage){
  const engine=await engineFor(language)
  const [result]=await engine.predict(input,{textDetLimitSideLen:1280,textRecScoreThresh:.28})
  const lines:OcrLine[]=(result?.items??[]).filter(i=>typeof i.text==='string'&&i.text.trim()).map(i=>({text:i.text.trim(),score:Number(i.score??0),poly:Array.isArray(i.poly)?i.poly.map(p=>[Number(p[0]),Number(p[1])]):[]})).sort((a,b)=>{const ay=a.poly[0]?.[1]??0,by=b.poly[0]?.[1]??0;if(Math.abs(ay-by)>14)return ay-by;return(a.poly[0]?.[0]??0)-(b.poly[0]?.[0]??0)})
  return{text:lines.map(l=>l.text).join('\n'),lines,averageConfidence:lines.length?lines.reduce((s,l)=>s+l.score,0)/lines.length:0}
}

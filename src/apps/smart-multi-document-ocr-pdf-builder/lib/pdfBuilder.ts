import { PDFDocument } from 'pdf-lib'
import type { DocumentPage } from './types'
const W=595.28,H=841.89
function wrap(ctx:CanvasRenderingContext2D,text:string,max:number){const words=text.replace(/\r/g,'').split(/\s+/).filter(Boolean),lines:string[]=[];let line=''
  for(const word of words){const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width<=max)line=next;else{if(line)lines.push(line);line=word}}if(line)lines.push(line);return lines.length?lines:['—']}
async function summaries(pages:DocumentPage[]){const canvases:HTMLCanvasElement[]=[],width=1400,height=1980,margin=70
  let canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;let ctx=canvas.getContext('2d');if(!ctx)throw new Error('Summary canvas unavailable.')
  const start=()=>{ctx!.fillStyle='#fff';ctx!.fillRect(0,0,width,height);ctx!.fillStyle='#111827';ctx!.font='700 42px Arial, sans-serif';ctx!.fillText('Document & OCR Summary',margin,80);ctx!.font='24px Arial, sans-serif';ctx!.fillStyle='#4b5563';ctx!.fillText(`Generated locally · ${new Date().toLocaleString()}`,margin,122);return 175}
  let y=start();const next=()=>{canvases.push(canvas);canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;ctx=canvas.getContext('2d');if(!ctx)throw new Error('Summary canvas unavailable.');y=start()}
  for(let i=0;i<pages.length;i++){const p=pages[i],d=p.detection,fields=d&&Object.keys(d.fields).length?Object.entries(d.fields).map(([k,v])=>`${k}: ${v}`).join(' · '):'No structured fields detected'
    ctx.font='700 28px Arial, sans-serif';const title=wrap(ctx,`${i+1}. ${p.fileName}`,width-margin*2)
    ctx.font='23px Arial, sans-serif';const meta=wrap(ctx,`Document: ${d?.type??'Unknown'} · Detection: ${d?.confidence??0}% · OCR: ${Math.round(p.averageConfidence*100)}%`,width-margin*2),fieldLines=wrap(ctx,fields,width-margin*2),ocr=wrap(ctx,p.ocrText||'No OCR text detected',width-margin*2)
    const req=38+title.length*36+meta.length*31+fieldLines.length*31+Math.min(ocr.length,24)*30+70;if(y+req>height-margin)next()
    ctx.fillStyle='#eef2ff';ctx.fillRect(margin-18,y-34,width-margin*2+36,req-15);ctx.fillStyle='#111827';ctx.font='700 28px Arial, sans-serif'
    for(const line of title){ctx.fillText(line,margin,y);y+=36}ctx.font='23px Arial, sans-serif';ctx.fillStyle='#334155';for(const line of meta){ctx.fillText(line,margin,y);y+=31}
    ctx.fillStyle='#0f766e';for(const line of fieldLines){ctx.fillText(line,margin,y);y+=31}ctx.fillStyle='#111827';ctx.font='22px Arial, sans-serif';ctx.fillText('OCR text:',margin,y);y+=30
    for(const line of ocr.slice(0,24)){ctx.fillText(line,margin,y);y+=30}if(ocr.length>24){ctx.fillStyle='#64748b';ctx.fillText(`… ${ocr.length-24} more lines omitted`,margin,y);y+=30}y+=50}
  canvases.push(canvas);return canvases}
export async function buildColorPdfWithOcrSummary(pages:DocumentPage[]):Promise<Blob>{
  const done=pages.filter(p=>p.colorBlob);if(!done.length)throw new Error('No processed colour pages are ready.')
  const pdf=await PDFDocument.create()
  for(const item of done){const image=await pdf.embedJpg(await item.colorBlob!.arrayBuffer()),ratio=Math.min((W-36)/image.width,(H-36)/image.height),dw=image.width*ratio,dh=image.height*ratio,page=pdf.addPage([W,H]);page.drawImage(image,{x:(W-dw)/2,y:(H-dh)/2,width:dw,height:dh})}
  for(const canvas of await summaries(done)){const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Summary page failed.')),'image/png')),image=await pdf.embedPng(await blob.arrayBuffer()),page=pdf.addPage([W,H]);page.drawImage(image,{x:0,y:0,width:W,height:H})}
  const savedBytes = await pdf.save()
  const pdfBuffer = new ArrayBuffer(savedBytes.byteLength)
  new Uint8Array(pdfBuffer).set(savedBytes)
  return new Blob([pdfBuffer], { type: 'application/pdf' })
}

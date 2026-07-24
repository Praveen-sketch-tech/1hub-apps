export interface ProcessedColorPage { canvas:HTMLCanvasElement; blob:Blob; width:number; height:number }
export async function loadImage(source:Blob|string):Promise<HTMLImageElement>{
  const url=typeof source==='string'?source:URL.createObjectURL(source)
  try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('The document image could not be decoded.'));image.src=url})}
  finally{if(typeof source!=='string')URL.revokeObjectURL(url)}
}
const clamp=(v:number)=>Math.max(0,Math.min(255,v))
export async function createColorEnhancedPage(source:Blob,rotation=0,maxSide=2200):Promise<ProcessedColorPage>{
  const image=await loadImage(source)
  const scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight))
  const sw=Math.max(1,Math.round(image.naturalWidth*scale)),sh=Math.max(1,Math.round(image.naturalHeight*scale))
  const work=document.createElement('canvas');work.width=sw;work.height=sh
  const ctx=work.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas processing is unavailable.')
  ctx.drawImage(image,0,0,sw,sh)
  const frame=ctx.getImageData(0,0,sw,sh),px=frame.data,f=(259*(12+255))/(255*(259-12))
  for(let i=0;i<px.length;i+=4){px[i]=clamp(f*(px[i]-128)+134);px[i+1]=clamp(f*(px[i+1]-128)+134);px[i+2]=clamp(f*(px[i+2]-128)+134)}
  ctx.putImageData(frame,0,0)
  const r=((rotation%360)+360)%360;let out=work
  if(r){out=document.createElement('canvas');const swap=r===90||r===270;out.width=swap?sh:sw;out.height=swap?sw:sh
    const c=out.getContext('2d');if(!c)throw new Error('Canvas rotation is unavailable.')
    c.translate(out.width/2,out.height/2);c.rotate(r*Math.PI/180);c.drawImage(work,-sw/2,-sh/2)}
  const blob=await new Promise<Blob>((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(new Error('Enhanced page could not be created.')),'image/jpeg',.92))
  return{canvas:out,blob,width:out.width,height:out.height}
}

import type { Quad, ScanPage, ScanSettings } from './types'

export const DEFAULT_SETTINGS:ScanSettings={mode:'color',brightness:0,contrast:10,threshold:155,sharpen:20,outputQuality:.92}

export function fullImageQuad(width:number,height:number):Quad{
  const x=width*.03,y=height*.03
  return {topLeft:{x,y},topRight:{x:width-x,y},bottomRight:{x:width-x,y:height-y},bottomLeft:{x,y:height-y}}
}

export function loadImage(src:string):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Image could not be loaded.'));img.src=src})
}

export async function detectDocumentQuad(src:string):Promise<Quad>{
  const img=await loadImage(src), scale=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight))
  const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale))
  const c=document.createElement('canvas');c.width=w;c.height=h
  const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)return fullImageQuad(img.naturalWidth,img.naturalHeight)
  ctx.drawImage(img,0,0,w,h);const d=ctx.getImageData(0,0,w,h).data
  const px=(x:number,y:number)=>{const i=(Math.max(0,Math.min(h-1,y))*w+Math.max(0,Math.min(w-1,x)))*4;return [d[i],d[i+1],d[i+2]]}
  const cs=[px(2,2),px(w-3,2),px(2,h-3),px(w-3,h-3)]
  const bg=[0,1,2].map(k=>cs.reduce((s,p)=>s+p[k],0)/4)
  let minX=w,minY=h,maxX=0,maxY=0,n=0
  const step=Math.max(1,Math.floor(Math.max(w,h)/500))
  for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
    const p=px(x,y),dist=Math.hypot(p[0]-bg[0],p[1]-bg[1],p[2]-bg[2])
    if(dist>46){n++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}
  }
  if(n<80||maxX-minX<w*.28||maxY-minY<h*.28)return fullImageQuad(img.naturalWidth,img.naturalHeight)
  const sx=img.naturalWidth/w,sy=img.naturalHeight/h,pad=8
  return {topLeft:{x:Math.max(0,minX-pad)*sx,y:Math.max(0,minY-pad)*sy},topRight:{x:Math.min(w,maxX+pad)*sx,y:Math.max(0,minY-pad)*sy},bottomRight:{x:Math.min(w,maxX+pad)*sx,y:Math.min(h,maxY+pad)*sy},bottomLeft:{x:Math.max(0,minX-pad)*sx,y:Math.min(h,maxY+pad)*sy}}
}

const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(b.x-a.x,b.y-a.y)
const clamp=(v:number)=>Math.max(0,Math.min(255,v))
export async function processScanPage(page:ScanPage,maxSide=2400){
  const img=await loadImage(page.sourceUrl),q=page.quad
  let w=Math.max(100,Math.round(Math.max(dist(q.topLeft,q.topRight),dist(q.bottomLeft,q.bottomRight))))
  let h=Math.max(100,Math.round(Math.max(dist(q.topLeft,q.bottomLeft),dist(q.topRight,q.bottomRight))))
  const s=Math.min(1,maxSide/Math.max(w,h));w=Math.round(w*s);h=Math.round(h*s)
  const sc=document.createElement('canvas');sc.width=img.naturalWidth;sc.height=img.naturalHeight
  const sx=sc.getContext('2d',{willReadFrequently:true});if(!sx)throw new Error('Canvas unavailable.')
  sx.drawImage(img,0,0);const src=sx.getImageData(0,0,sc.width,sc.height)
  const out=document.createElement('canvas');out.width=w;out.height=h
  const ox=out.getContext('2d',{willReadFrequently:true});if(!ox)throw new Error('Canvas unavailable.')
  const data=ox.createImageData(w,h)
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/(w-1||1),v=y/(h-1||1)
    const tx=q.topLeft.x+(q.topRight.x-q.topLeft.x)*u,ty=q.topLeft.y+(q.topRight.y-q.topLeft.y)*u
    const bx=q.bottomLeft.x+(q.bottomRight.x-q.bottomLeft.x)*u,by=q.bottomLeft.y+(q.bottomRight.y-q.bottomLeft.y)*u
    const px=Math.round(tx+(bx-tx)*v),py=Math.round(ty+(by-ty)*v),si=(Math.max(0,Math.min(src.height-1,py))*src.width+Math.max(0,Math.min(src.width-1,px)))*4,di=(y*w+x)*4
    let r=src.data[si],g=src.data[si+1],b=src.data[si+2]
    const f=(259*(page.settings.contrast+255))/(255*(259-page.settings.contrast))
    r=clamp(f*(r-128)+128+page.settings.brightness);g=clamp(f*(g-128)+128+page.settings.brightness);b=clamp(f*(b-128)+128+page.settings.brightness)
    if(page.settings.mode==='grayscale'||page.settings.mode==='black-white'){let z=clamp(r*.299+g*.587+b*.114);if(page.settings.mode==='black-white')z=z>=page.settings.threshold?255:0;r=g=b=z}
    data.data[di]=r;data.data[di+1]=g;data.data[di+2]=b;data.data[di+3]=255
  }
  ox.putImageData(data,0,0)
  let final=out,rot=((page.rotation%360)+360)%360
  if(rot){final=document.createElement('canvas');const swap=rot===90||rot===270;final.width=swap?h:w;final.height=swap?w:h;const fx=final.getContext('2d');if(!fx)throw new Error('Rotation unavailable.');fx.translate(final.width/2,final.height/2);fx.rotate(rot*Math.PI/180);fx.drawImage(out,-w/2,-h/2)}
  const blob=await new Promise<Blob>((resolve,reject)=>final.toBlob(b=>b?resolve(b):reject(new Error('Export failed.')),'image/jpeg',page.settings.outputQuality))
  return {blob,width:final.width,height:final.height}
}
export function outputFileName(name:string){return `${name.replace(/\.[^.]+$/,'')||'document'}-scanned.jpg`}

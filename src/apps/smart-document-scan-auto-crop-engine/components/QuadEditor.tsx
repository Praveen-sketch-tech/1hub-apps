import type { PointerEvent } from 'react'
import { useRef } from 'react'
import type { Quad } from '../lib/types'
const keys=['topLeft','topRight','bottomRight','bottomLeft'] as const
export function QuadEditor({imageUrl,imageWidth,imageHeight,quad,onChange}:{imageUrl:string;imageWidth:number;imageHeight:number;quad:Quad;onChange:(q:Quad)=>void}){
  const ref=useRef<HTMLDivElement>(null)
  const move=(key:typeof keys[number],e:PointerEvent<HTMLButtonElement>)=>{
    e.preventDefault()
    const update=(x:number,y:number)=>{const r=ref.current?.getBoundingClientRect();if(!r)return;onChange({...quad,[key]:{x:Math.max(0,Math.min(imageWidth,(x-r.left)/r.width*imageWidth)),y:Math.max(0,Math.min(imageHeight,(y-r.top)/r.height*imageHeight))}})}
    update(e.clientX,e.clientY)
    const mm=(ev:globalThis.PointerEvent)=>update(ev.clientX,ev.clientY),up=()=>{window.removeEventListener('pointermove',mm);window.removeEventListener('pointerup',up)}
    window.addEventListener('pointermove',mm);window.addEventListener('pointerup',up)
  }
  const polygon=keys.map(k=>`${quad[k].x/imageWidth*100},${quad[k].y/imageHeight*100}`).join(' ')
  return <div className="sdac-stage" ref={ref}><img src={imageUrl} alt="Document crop preview" draggable={false}/><svg className="sdac-overlay" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points={polygon}/></svg>{keys.map(k=><button key={k} type="button" className="sdac-handle" style={{left:`${quad[k].x/imageWidth*100}%`,top:`${quad[k].y/imageHeight*100}%`}} onPointerDown={e=>move(k,e)} aria-label={`Move ${k} corner`}/>)}</div>
}

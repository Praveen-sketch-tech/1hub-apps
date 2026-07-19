import { useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Quad, Point } from '../lib/types'

type Key = keyof Quad
interface Props { imageUrl:string; width:number; height:number; quad:Quad; onChange:(q:Quad)=>void }

export default function CornerCropEditor({imageUrl,width,height,quad,onChange}:Props) {
  const box = useRef<HTMLDivElement>(null)
  const points = useMemo(() => Object.entries(quad) as [Key,Point][], [quad])
  const move = (key:Key, e:ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const handler = (ev:PointerEvent) => {
      const r=box.current?.getBoundingClientRect(); if(!r) return
      const x=Math.max(0,Math.min(width,((ev.clientX-r.left)/r.width)*width)); const y=Math.max(0,Math.min(height,((ev.clientY-r.top)/r.height)*height))
      onChange({...quad,[key]:{x,y}})
    }
    const up = () => { window.removeEventListener('pointermove',handler); window.removeEventListener('pointerup',up) }
    window.addEventListener('pointermove',handler); window.addEventListener('pointerup',up)
  }
  const poly = `${quad.tl.x/width*100},${quad.tl.y/height*100} ${quad.tr.x/width*100},${quad.tr.y/height*100} ${quad.br.x/width*100},${quad.br.y/height*100} ${quad.bl.x/width*100},${quad.bl.y/height*100}`
  return <div className="sdoc-crop" ref={box} style={{aspectRatio:`${width}/${height}`}}>
    <img src={imageUrl} alt="Document page" draggable={false}/>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points={poly} /></svg>
    {points.map(([k,p])=><button key={k} className="sdoc-handle" aria-label={`Move ${k} corner`} onPointerDown={e=>move(k,e)} style={{left:`${p.x/width*100}%`,top:`${p.y/height*100}%`}} />)}
  </div>
}

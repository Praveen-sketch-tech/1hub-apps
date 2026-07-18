import { useEffect, useMemo, useRef, useState } from 'react'
import CornerCropEditor from './components/CornerCropEditor'
import { DEFAULT_SETTINGS, defaultQuad, detectDocumentQuad, estimateDeskewAngle, loadImage, renderProcessedPage } from './lib/imageProcessing'
import { pdfToPages } from './lib/pdfLoader'
import { cancelOcr, disposeOcr, recognizeCanvas } from './lib/ocrEngine'
import { exportPageImage, exportPdf, exportText } from './lib/exporters'
import type { DocumentPage, OcrLanguage, ScanMode } from './lib/types'
import './smart-document-scanner-ocr.css'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'

const MODES: {v:ScanMode;l:string}[] = [
  {v:'original',l:'Original'},{v:'auto',l:'Auto Enhance'},{v:'color',l:'Color Document'},
  {v:'grayscale',l:'Grayscale'},{v:'bw',l:'Black & White'},{v:'high-contrast',l:'High Contrast'},
]

export default function SmartDocumentScannerOcrPage() {
  const [pages,setPages]=useState<DocumentPage[]>([]); const [active,setActive]=useState<string>(''); const [busy,setBusy]=useState('')
  const [lang,setLang]=useState<OcrLanguage>('eng'); const [query,setQuery]=useState(''); const dragIndex=useRef<number|null>(null)
  const current=pages.find(p=>p.id===active) || pages[0]
  useEffect(()=>()=>{ pages.forEach(p=>URL.revokeObjectURL(p.sourceUrl)); void disposeOcr() },[])
  const update=(id:string,fn:(p:DocumentPage)=>DocumentPage)=>setPages(ps=>ps.map(p=>p.id===id?fn(p):p))

  const ingest=async(files:FileList|File[])=>{
    setBusy('Importing files…'); const added:DocumentPage[]=[]
    try { for(const file of Array.from(files)) {
      if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')) { added.push(...await pdfToPages(file)); continue }
      if(!file.type.startsWith('image/')) continue
      const url=URL.createObjectURL(file); const img=await loadImage(url)
      added.push({id:crypto.randomUUID(),name:file.name,sourceUrl:url,width:img.naturalWidth,height:img.naturalHeight,rotation:0,quad:defaultQuad(img.naturalWidth,img.naturalHeight),settings:{...DEFAULT_SETTINGS},ocr:{text:'',progress:0,status:'idle'}})
    }} finally { setBusy('') }
    if(added.length){ setPages(p=>[...p,...added]); setActive(a=>a||added[0].id) }
  }

  const runOcr=async(ids:string[])=>{
    setBusy('Starting OCR…')
    for(let i=0;i<ids.length;i++){
      const id=ids[i]; const page=pages.find(p=>p.id===id); if(!page) continue
      update(id,p=>({...p,ocr:{...p.ocr,status:'running',progress:0,error:undefined}}))
      try { const canvas=await renderProcessedPage(page,2200); const text=await recognizeCanvas(canvas,lang,(progress,status)=>{setBusy(`OCR ${i+1}/${ids.length} · ${status}`); update(id,p=>({...p,ocr:{...p.ocr,status:'running',progress}}))}); update(id,p=>({...p,ocr:{text,status:'done',progress:100}})) }
      catch(e){ update(id,p=>({...p,ocr:{...p.ocr,status:'error',error:e instanceof Error?e.message:String(e)}})); if(String(e).includes('cancel')) break }
    }
    setBusy('')
  }
  const combined=useMemo(()=>pages.map((p,i)=>`Page ${i+1}\n${p.ocr.text}`).join('\n\n'),[pages])
  const matches=query.trim()?combined.toLowerCase().split(query.toLowerCase()).length-1:0

  return <main className="sdoc-app">
    <ToolAppHeader
        appNumber="008"
        title="Smart Document Scanner & OCR"
        description="Scan, clean, recognize and export multi-page documents directly in your browser."
      />

    <section className="sdoc-upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void ingest(e.dataTransfer.files)}}>
      <div><strong>Drop images or PDFs here</strong><span>JPG, PNG, WebP and PDF · Multiple files supported</span></div>
      <label className="sdoc-primary">Add documents<input hidden type="file" multiple accept="image/*,.pdf,application/pdf" onChange={e=>e.target.files&&void ingest(e.target.files)}/></label>
    </section>

    {pages.length===0 ? <section className="sdoc-empty"><div className="sdoc-empty-icon">▤</div><h2>Your scanner workspace is ready</h2><p>Add a photo or PDF to crop, enhance, OCR and export it.</p></section> : <>
      <section className="sdoc-workspace">
        <div className="sdoc-preview-panel">
          <div className="sdoc-panel-head"><h2>{current?.name}</h2><div className="sdoc-inline"><button onClick={()=>current&&void detectDocumentQuad(current.sourceUrl).then(q=>update(current.id,p=>({...p,quad:q})))}>Auto edges</button><button onClick={()=>current&&void estimateDeskewAngle(current).then(a=>update(current.id,p=>({...p,rotation:a})))}>Deskew</button><button onClick={()=>current&&update(current.id,p=>({...p,rotation:(p.rotation+270)%360}))}>↶ Rotate</button><button onClick={()=>current&&update(current.id,p=>({...p,rotation:(p.rotation+90)%360}))}>Rotate ↷</button></div></div>
          {current&&<CornerCropEditor imageUrl={current.sourceUrl} width={current.width} height={current.height} quad={current.quad} onChange={q=>update(current.id,p=>({...p,quad:q}))}/>} 
          <p className="sdoc-tip">Drag the four corner handles to match the document edges. Full-image crop is used as a safe fallback.</p>
        </div>
        <aside className="sdoc-controls">
          <h3>Enhancement</h3>
          <div className="sdoc-mode-grid">{MODES.map(m=><button className={current?.settings.mode===m.v?'active':''} key={m.v} onClick={()=>current&&update(current.id,p=>({...p,settings:{...p.settings,mode:m.v}}))}>{m.l}</button>)}</div>
          {current&&<>
            <label>Brightness <span>{current.settings.brightness}</span><input type="range" min="-80" max="80" value={current.settings.brightness} onChange={e=>update(current.id,p=>({...p,settings:{...p.settings,brightness:+e.target.value}}))}/></label>
            <label>Contrast <span>{current.settings.contrast}</span><input type="range" min="-100" max="100" value={current.settings.contrast} onChange={e=>update(current.id,p=>({...p,settings:{...p.settings,contrast:+e.target.value}}))}/></label>
            <label>Sharpen <span>{current.settings.sharpen}</span><input type="range" min="0" max="100" value={current.settings.sharpen} onChange={e=>update(current.id,p=>({...p,settings:{...p.settings,sharpen:+e.target.value}}))}/></label>
            {current.settings.mode==='bw'&&<label>B&amp;W threshold <span>{current.settings.threshold}</span><input type="range" min="70" max="220" value={current.settings.threshold} onChange={e=>update(current.id,p=>({...p,settings:{...p.settings,threshold:+e.target.value}}))}/></label>}
          </>}
        </aside>
      </section>

      <section className="sdoc-pages"><div className="sdoc-panel-head"><h2>Pages <span>{pages.length}</span></h2><button onClick={()=>{pages.forEach(p=>URL.revokeObjectURL(p.sourceUrl));setPages([]);setActive('')}}>Clear all</button></div><div className="sdoc-thumbs">{pages.map((p,i)=><article key={p.id} draggable onDragStart={()=>dragIndex.current=i} onDragOver={e=>e.preventDefault()} onDrop={()=>{const from=dragIndex.current;if(from===null||from===i)return;setPages(ps=>{const n=[...ps];const [x]=n.splice(from,1);n.splice(i,0,x);return n});dragIndex.current=null}} className={p.id===current?.id?'active':''} onClick={()=>setActive(p.id)}><img src={p.sourceUrl} alt=""/><div><strong>Page {i+1}</strong><small>{p.ocr.status==='done'?'OCR ready':p.name}</small></div><button aria-label="Delete page" onClick={e=>{e.stopPropagation();URL.revokeObjectURL(p.sourceUrl);setPages(ps=>ps.filter(x=>x.id!==p.id));if(active===p.id)setActive('')}}>×</button></article>)}</div></section>

      <section className="sdoc-ocr"><div className="sdoc-panel-head"><div><h2>OCR text extraction</h2><p>OCR runs in-browser. Language data may be downloaded and cached on first use.</p></div><select value={lang} onChange={e=>setLang(e.target.value as OcrLanguage)}><option value="eng">English</option><option value="hin">Hindi</option><option value="eng+hin">English + Hindi</option></select></div>
        <div className="sdoc-actions"><button className="sdoc-primary" disabled={!current||!!busy} onClick={()=>current&&void runOcr([current.id])}>OCR current page</button><button disabled={!!busy} onClick={()=>void runOcr(pages.map(p=>p.id))}>OCR all pages</button>{busy&&<button onClick={()=>cancelOcr()}>Cancel OCR</button>}</div>
        {busy&&<div className="sdoc-status">{busy}</div>}
        <div className="sdoc-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search extracted text…"/><span>{query?`${matches} match${matches===1?'':'es'}`:'Search across all pages'}</span></div>
        <textarea value={current?.ocr.text||''} onChange={e=>current&&update(current.id,p=>({...p,ocr:{...p.ocr,text:e.target.value,status:'done'}}))} placeholder="OCR text for the selected page will appear here…"/>
        <div className="sdoc-actions"><button disabled={!current?.ocr.text} onClick={()=>current&&navigator.clipboard.writeText(current.ocr.text)}>Copy page text</button><button disabled={!combined.trim()} onClick={()=>navigator.clipboard.writeText(combined)}>Copy all text</button><button disabled={!combined.trim()} onClick={()=>exportText(pages)}>Export TXT</button></div>
      </section>

      <section className="sdoc-export"><div><h2>Export</h2><p>Export the cleaned current page or combine all pages into a PDF.</p></div><div className="sdoc-actions"><button onClick={()=>current&&void exportPageImage(current,'jpeg')}>Cleaned JPG</button><button onClick={()=>current&&void exportPageImage(current,'png')}>Cleaned PNG</button><button onClick={()=>void exportPdf(pages,false)}>PDF</button><button className="sdoc-primary" disabled={!pages.some(p=>p.ocr.text.trim())} onClick={()=>void exportPdf(pages,true)}>Searchable PDF</button></div></section>
    </>}
  </main>
}

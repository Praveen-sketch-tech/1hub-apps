import { useMemo, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { downloadBlob } from '@shared/utils/downloads'
import { QuadEditor } from './components/QuadEditor'
import { DEFAULT_SETTINGS, detectDocumentQuad, fullImageQuad, loadImage, outputFileName, processScanPage } from './lib/scanProcessing'
import type { ScanMode, ScanPage } from './lib/types'
import './smart-document-scan-auto-crop-engine.css'

const modes:[ScanMode,string][]= [['color','Color scan'],['grayscale','Grayscale'],['black-white','Black & white'],['original','Original']]

export function SmartDocumentScanAutoCropEnginePage(){
  const [pages,setPages]=useState<ScanPage[]>([]),[activeId,setActiveId]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('Add a document photo to begin.'),[preview,setPreview]=useState('')
  const active=useMemo(()=>pages.find(p=>p.id===activeId)||pages[0],[pages,activeId])
  const update=(fn:(p:ScanPage)=>ScanPage)=>active&&setPages(ps=>ps.map(p=>p.id===active.id?fn(p):p))
  const add=async(list:FileList|File[])=>{const fs=Array.from(list).filter(f=>f.type.startsWith('image/'));if(!fs.length){setStatus('Choose an image file.');return}setBusy(true);const added:ScanPage[]=[];try{for(const f of fs){const u=URL.createObjectURL(f),img=await loadImage(u),quad=await detectDocumentQuad(u);added.push({id:crypto.randomUUID(),name:f.name,sourceUrl:u,width:img.naturalWidth,height:img.naturalHeight,quad,rotation:0,settings:{...DEFAULT_SETTINGS}})}setPages(p=>[...p,...added]);setActiveId(a=>a||added[0].id);setStatus(`${added.length} document image${added.length===1?'':'s'} added. Auto-crop is ready.`)}catch(e){setStatus(e instanceof Error?e.message:'Import failed.')}finally{setBusy(false)}}
  const auto=async()=>{if(!active)return;setBusy(true);try{const q=await detectDocumentQuad(active.sourceUrl);update(p=>({...p,quad:q}));setStatus('Edges detected. Adjust corners if needed.')}finally{setBusy(false)}}
  const makePreview=async()=>{if(!active)return;setBusy(true);try{const r=await processScanPage(active,1600);if(preview)URL.revokeObjectURL(preview);setPreview(URL.createObjectURL(r.blob));setStatus(`Preview ready · ${r.width}×${r.height}px`)}catch(e){setStatus(e instanceof Error?e.message:'Preview failed.')}finally{setBusy(false)}}
  const exportScan=async()=>{if(!active)return;setBusy(true);try{const r=await processScanPage(active);setStatus(downloadBlob(r.blob,outputFileName(active.name))?'Download started ✓':'Download failed.')}catch(e){setStatus(e instanceof Error?e.message:'Export failed.')}finally{setBusy(false)}}
  return <main className="tool-page smart-document-scan-auto-crop-engine-page">
    <ToolAppHeader appNumber="030" title="Smart Document Scan & Auto-Crop Engine" description="Detect document edges, correct perspective, enhance scans and export clean document images locally in your browser."/>
    <section className="tool-panel sdac-upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void add(e.dataTransfer.files)}}>
      <div><h2>Scan or add documents</h2><p className="tool-muted">Camera photos, JPG, PNG and WebP. Multiple pages supported.</p></div>
      <div className="tool-actions"><label className="tool-button tool-button-primary">Use camera<input hidden type="file" accept="image/*" capture="environment" onChange={e=>e.target.files&&void add(e.target.files)}/></label><label className="tool-button">Choose images<input hidden multiple type="file" accept="image/*" onChange={e=>e.target.files&&void add(e.target.files)}/></label></div>
    </section>
    {!active?<section className="tool-panel sdac-empty"><div>▱</div><h2>Auto-crop workspace ready</h2><p className="tool-muted">Photograph a document on a contrasting surface for the best automatic edge suggestion.</p></section>:<>
      <section className="sdac-workspace">
        <div className="tool-panel sdac-editor"><div className="sdac-head"><div><h2>{active.name}</h2><p className="tool-muted">Drag the four handles onto the real document corners.</p></div><div className="tool-actions"><button className="tool-button" disabled={busy} onClick={()=>void auto()}>Auto edges</button><button className="tool-button" onClick={()=>update(p=>({...p,quad:fullImageQuad(p.width,p.height)}))}>Full image</button><button className="tool-button" onClick={()=>update(p=>({...p,rotation:(p.rotation+90)%360}))}>Rotate ↷</button></div></div><QuadEditor imageUrl={active.sourceUrl} imageWidth={active.width} imageHeight={active.height} quad={active.quad} onChange={q=>update(p=>({...p,quad:q}))}/></div>
        <aside className="tool-panel sdac-controls"><h2>Enhancement</h2><label className="tool-field"><span className="tool-label">Mode</span><select className="tool-select" value={active.settings.mode} onChange={e=>update(p=>({...p,settings:{...p.settings,mode:e.target.value as ScanMode}}))}>{modes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label className="tool-field"><span className="tool-label">Brightness · {active.settings.brightness}</span><input type="range" min="-80" max="80" value={active.settings.brightness} onChange={e=>update(p=>({...p,settings:{...p.settings,brightness:+e.target.value}}))}/></label>
          <label className="tool-field"><span className="tool-label">Contrast · {active.settings.contrast}</span><input type="range" min="-100" max="100" value={active.settings.contrast} onChange={e=>update(p=>({...p,settings:{...p.settings,contrast:+e.target.value}}))}/></label>
          {active.settings.mode==='black-white'&&<label className="tool-field"><span className="tool-label">Threshold · {active.settings.threshold}</span><input type="range" min="70" max="220" value={active.settings.threshold} onChange={e=>update(p=>({...p,settings:{...p.settings,threshold:+e.target.value}}))}/></label>}
          <div className="tool-actions"><button className="tool-button" disabled={busy} onClick={()=>void makePreview()}>Preview</button><button className="tool-button tool-button-primary" disabled={busy} onClick={()=>void exportScan()}>Export JPG</button></div>
        </aside>
      </section>
      {preview&&<section className="tool-panel"><div className="sdac-head"><div><h2>Cleaned preview</h2><p className="tool-muted">Perspective-corrected result.</p></div><button className="tool-button" onClick={()=>setPreview('')}>Close</button></div><div className="sdac-preview"><img src={preview} alt="Processed document"/></div></section>}
      <section className="tool-panel"><div className="sdac-head"><div><h2>Pages · {pages.length}</h2><p className="tool-muted">Select a page to edit.</p></div><button className="tool-button" onClick={()=>{pages.forEach(p=>URL.revokeObjectURL(p.sourceUrl));setPages([]);setActiveId('');setPreview('')}}>Clear all</button></div><div className="sdac-pages">{pages.map((p,i)=><article key={p.id} className={`sdac-page-card ${p.id===active.id?'is-active':''}`} onClick={()=>{setActiveId(p.id);setPreview('')}}><img src={p.sourceUrl} alt=""/><div><strong>Page {i+1}</strong><span>{p.name}</span></div><button aria-label="Delete page" onClick={e=>{e.stopPropagation();URL.revokeObjectURL(p.sourceUrl);setPages(ps=>ps.filter(x=>x.id!==p.id));if(activeId===p.id)setActiveId('')}}>×</button></article>)}</div></section>
    </>}
    <div className="sdac-status" role="status">{busy?'Working… ':''}{status}</div>
  </main>
}

import { ChangeEvent,DragEvent,useEffect,useMemo,useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { downloadBlob } from '@shared/utils/downloads'
import { formatFileSize } from '@shared/utils/files'
import { detectDocument } from './lib/documentClassifier'
import { createColorEnhancedPage,loadImage } from './lib/imageProcessing'
import { runPaddleOcr } from './lib/paddleOcr'
import { buildColorPdfWithOcrSummary } from './lib/pdfBuilder'
import { pdfToImageFiles } from './lib/pdfInput'
import type { DocumentPage,OcrLanguage } from './lib/types'
import './smart-multi-document-ocr-pdf-builder.css'

const ACCEPT='image/*,.pdf,application/pdf'
async function createPage(file:File):Promise<DocumentPage>{const image=await loadImage(file);return{id:crypto.randomUUID(),fileName:file.name,sourceFile:file,sourceUrl:URL.createObjectURL(file),width:image.naturalWidth,height:image.naturalHeight,rotation:0,status:'queued',progress:0,statusText:'Ready',ocrText:'',ocrLines:[],averageConfidence:0}}

export function SmartMultiDocumentOcrPdfBuilderPage(){
 const[pages,setPages]=useState<DocumentPage[]>([]),[language,setLanguage]=useState<OcrLanguage>('hi'),[busy,setBusy]=useState(false),[status,setStatus]=useState('Add multiple document images or PDFs.'),[previewId,setPreviewId]=useState<string|null>(null)
 const completed=useMemo(()=>pages.filter(p=>p.status==='done'),[pages]),previewPage=pages.find(p=>p.id===previewId)
 useEffect(()=>()=>{pages.forEach(p=>{URL.revokeObjectURL(p.sourceUrl);if(p.colorUrl)URL.revokeObjectURL(p.colorUrl)})},[])
 const update=(id:string,patch:Partial<DocumentPage>)=>setPages(cur=>cur.map(p=>p.id===id?{...p,...patch}:p))

 async function addFiles(list:FileList|File[]){if(busy)return;setBusy(true);setStatus('Importing documents…')
  try{const images:File[]=[];for(const f of Array.from(list)){if(f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf'))images.push(...await pdfToImageFiles(f));else if(f.type.startsWith('image/'))images.push(f)}
   const created:DocumentPage[]=[];for(const f of images)created.push(await createPage(f));setPages(cur=>[...cur,...created]);setStatus(`Added ${created.length} page${created.length===1?'':'s'}. Tap Process all.`)}
  catch(e){setStatus(e instanceof Error?e.message:'Documents could not be imported.')}finally{setBusy(false)}}

 async function processIds(ids:string[]){if(!ids.length||busy)return;setBusy(true)
  try{for(let i=0;i<ids.length;i++){const id=ids[i],page=pages.find(p=>p.id===id);if(!page)continue
   update(id,{status:'processing',progress:10,statusText:'Enhancing colour page…',error:undefined});setStatus(`Processing ${i+1}/${ids.length}: ${page.fileName}`)
   try{const enhanced=await createColorEnhancedPage(page.sourceFile,page.rotation),colorUrl=URL.createObjectURL(enhanced.blob)
    update(id,{colorBlob:enhanced.blob,colorUrl,width:enhanced.width,height:enhanced.height,progress:38,statusText:'Running PaddleOCR…'})
    const ocr=await runPaddleOcr(enhanced.canvas,language),detection=detectDocument(ocr.text)
    update(id,{status:'done',progress:100,statusText:`${detection.type} · ${detection.confidence}%`,ocrText:ocr.text,ocrLines:ocr.lines,averageConfidence:ocr.averageConfidence,detection})}
   catch(e){update(id,{status:'error',progress:0,statusText:'Processing failed',error:e instanceof Error?e.message:String(e)})}}
   setStatus('Processing complete. Review document types and OCR text, then generate the colour PDF.')}finally{setBusy(false)}}

 async function generatePdf(){if(!completed.length||busy)return;setBusy(true);setStatus('Generating colour PDF and OCR summary pages…')
  try{const blob=await buildColorPdfWithOcrSummary(pages),ok=downloadBlob(blob,'multi-document-ocr-colour-bundle.pdf',4000);setStatus(ok?'Colour PDF download started ✓':'PDF download could not start.')}
  catch(e){setStatus(e instanceof Error?e.message:'PDF generation failed.')}finally{setBusy(false)}}

 function rotate(page:DocumentPage){if(page.colorUrl)URL.revokeObjectURL(page.colorUrl);update(page.id,{rotation:(page.rotation+90)%360,status:'queued',progress:0,statusText:'Rotation changed · process again',colorBlob:undefined,colorUrl:undefined,ocrText:'',ocrLines:[],detection:undefined})}
 function remove(page:DocumentPage){URL.revokeObjectURL(page.sourceUrl);if(page.colorUrl)URL.revokeObjectURL(page.colorUrl);setPages(cur=>cur.filter(p=>p.id!==page.id));if(previewId===page.id)setPreviewId(null)}

 return <main className="tool-page smdop-page">
  <ToolAppHeader appNumber="033" title="Smart Multi-Document OCR & PDF Builder" description="Enhance multiple documents, run browser-local PaddleOCR, identify document types and export one colour PDF with OCR summary pages."/>
  <section className="tool-panel smdop-upload" onDragOver={(e:DragEvent<HTMLElement>)=>e.preventDefault()} onDrop={(e:DragEvent<HTMLElement>)=>{e.preventDefault();void addFiles(e.dataTransfer.files)}}>
   <div><h2>Add documents</h2><p className="tool-muted">Images and PDFs · PDF pages become colour images for processing.</p></div>
   <div className="tool-actions">
    <label className="tool-button tool-button-primary">Choose files<input hidden multiple type="file" accept={ACCEPT} onChange={(e:ChangeEvent<HTMLInputElement>)=>e.target.files&&void addFiles(e.target.files)}/></label>
    <label className="tool-button">Use camera<input hidden type="file" accept="image/*" capture="environment" onChange={(e:ChangeEvent<HTMLInputElement>)=>e.target.files&&void addFiles(e.target.files)}/></label>
   </div>
  </section>
  <section className="tool-panel smdop-toolbar">
   <label className="tool-field"><span className="tool-label">OCR model</span><select className="tool-select" value={language} onChange={e=>setLanguage(e.target.value as OcrLanguage)} disabled={busy}><option value="hi">Hindi + English</option><option value="en">English only (faster)</option></select></label>
   <div className="tool-actions">
    <button className="tool-button tool-button-primary" disabled={!pages.length||busy} onClick={()=>void processIds(pages.map(p=>p.id))}>{busy?'Working…':`Process all ${pages.length||''}`}</button>
    <button className="tool-button" disabled={!completed.length||busy} onClick={()=>void generatePdf()}>Generate colour PDF + OCR summary</button>
    <button className="tool-button" disabled={!pages.length||busy} onClick={()=>{pages.forEach(p=>{URL.revokeObjectURL(p.sourceUrl);if(p.colorUrl)URL.revokeObjectURL(p.colorUrl)});setPages([]);setPreviewId(null);setStatus('Workspace cleared.')}}>Clear all</button>
   </div>
  </section>
  <section className="smdop-status" aria-live="polite">{status}</section>
  {pages.length===0?<section className="tool-panel smdop-empty"><div>▤</div><h2>Multi-document workspace ready</h2><p className="tool-muted">Every uploaded page will appear below with colour preview, OCR text and detected details.</p></section>:
  <section className="smdop-list">{pages.map((page,index)=><article className="tool-card smdop-document" key={page.id}>
   <div className="smdop-document-head"><div><span className="smdop-page-number">Document {index+1}</span><h2>{page.fileName}</h2><p className="tool-muted">{formatFileSize(page.sourceFile.size)} · {page.width}×{page.height}px</p></div>
    <div className="tool-actions"><button className="tool-button" disabled={busy} onClick={()=>rotate(page)}>Rotate</button><button className="tool-button" onClick={()=>setPreviewId(page.id)}>Large preview</button><button className="tool-button" disabled={busy} onClick={()=>remove(page)}>Remove</button></div>
   </div>
   <div className="smdop-document-grid">
    <button className="smdop-preview" type="button" onClick={()=>setPreviewId(page.id)}><img src={page.colorUrl??page.sourceUrl} alt={`Preview of ${page.fileName}`}/><span>{page.colorUrl?'Enhanced colour preview':'Original colour preview'}</span></button>
    <div className="tool-stack">
     {page.status==='processing'&&<div><div className="smdop-progress"><span style={{width:`${page.progress}%`}}/></div><p>{page.statusText}</p></div>}
     {page.error&&<div className="smdop-error">{page.error}</div>}
     <div className="smdop-detection"><div><span>Detected document</span><strong>{page.detection?.type??'Not processed'}</strong></div><div><span>Detection confidence</span><strong>{page.detection?`${page.detection.confidence}%`:'—'}</strong></div><div><span>OCR confidence</span><strong>{page.status==='done'?`${Math.round(page.averageConfidence*100)}%`:'—'}</strong></div></div>
     {page.detection&&Object.keys(page.detection.fields).length>0&&<div className="smdop-fields">{Object.entries(page.detection.fields).map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>}
     <label className="tool-field"><span className="tool-label">OCR text · editable before PDF</span><textarea className="tool-textarea smdop-ocr-text" value={page.ocrText} placeholder={page.status==='done'?'No text detected.':'Process this document to run PaddleOCR.'} onChange={e=>update(page.id,{ocrText:e.target.value,detection:detectDocument(e.target.value)})}/></label>
     <button className="tool-button" disabled={busy} onClick={()=>void processIds([page.id])}>Process this document again</button>
    </div>
   </div>
  </article>)}</section>}
  {previewPage&&<div className="smdop-modal" role="dialog" aria-modal="true" onClick={()=>setPreviewId(null)}><div className="smdop-modal-dialog" onClick={e=>e.stopPropagation()}><div className="smdop-modal-head"><strong>{previewPage.fileName}</strong><button className="tool-button" onClick={()=>setPreviewId(null)}>Close</button></div><img src={previewPage.colorUrl??previewPage.sourceUrl} alt={`Large preview of ${previewPage.fileName}`}/></div></div>}
 </main>
}

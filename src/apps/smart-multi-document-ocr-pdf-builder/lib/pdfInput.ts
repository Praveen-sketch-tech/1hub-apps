import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
pdfjsLib.GlobalWorkerOptions.workerSrc=pdfWorker
async function renderPage(page:PDFPageProxy):Promise<Blob>{
  const viewport=page.getViewport({scale:1.7}),canvas=document.createElement('canvas')
  canvas.width=Math.round(viewport.width);canvas.height=Math.round(viewport.height)
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('PDF rendering is unavailable.')
  await page.render({canvasContext:ctx,viewport}).promise
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not render PDF page.')),'image/jpeg',.94))
}
export async function pdfToImageFiles(file:File,maxPages=30):Promise<File[]>{
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise
  const pages:File[]=[]
  for(let n=1;n<=Math.min(pdf.numPages,maxPages);n++){const blob=await renderPage(await pdf.getPage(n));pages.push(new File([blob],`${file.name.replace(/\.pdf$/i,'')}-page-${n}.jpg`,{type:'image/jpeg'}))}
  return pages
}

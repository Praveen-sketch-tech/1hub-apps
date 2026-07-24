import type { AppChatModule } from '@core/chat/types'
import { detectDocument } from './lib/documentClassifier'
import { createColorEnhancedPage } from './lib/imageProcessing'
import { runPaddleOcr } from './lib/paddleOcr'
export const chatModule:AppChatModule={appId:'smart-multi-document-ocr-pdf-builder',actions:[{
 id:'paddle-ocr-identify-document',appId:'smart-multi-document-ocr-pdf-builder',label:'OCR and identify document',
 description:'Enhance an attached image, run PaddleOCR and report its likely document type and extracted text.',
 keywords:['paddle ocr','identify document','read document','ocr document','extract document text'],requiresFile:true,accepts:['image/*'],
 canHandle:({input,file})=>Boolean(file?.type.startsWith('image/')&&/paddle|ocr|identify document|read document|extract.*text/i.test(input)),
 execute:async({input,file})=>{if(!file)return null;const enhanced=await createColorEnhancedPage(file),ocr=await runPaddleOcr(enhanced.canvas,/english only/i.test(input)?'en':'hi'),d=detectDocument(ocr.text),fields=Object.entries(d.fields).map(([k,v])=>`${k}: ${v}`).join(' · ')
 return{text:[`Likely document: ${d.type} (${d.confidence}% confidence).`,fields||'No structured identifier fields detected.','',ocr.text||'No OCR text detected.'].join('\n')}}}]}

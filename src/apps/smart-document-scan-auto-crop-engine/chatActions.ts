import type { AppChatModule } from '@core/chat/types'
import { DEFAULT_SETTINGS, detectDocumentQuad, loadImage, outputFileName, processScanPage } from './lib/scanProcessing'
import type { ScanPage } from './lib/types'

export const chatModule:AppChatModule={appId:'smart-document-scan-auto-crop-engine',actions:[{
  id:'scan-auto-crop-document',appId:'smart-document-scan-auto-crop-engine',label:'Auto-crop and clean document',
  description:'Detect document edges, correct perspective and export a clean scan from an attached image.',
  keywords:['scan document','auto crop document','clean document photo','perspective correct'],requiresFile:true,accepts:['image/*'],
  canHandle:({input,file})=>Boolean(file?.type.startsWith('image/')&&/scan|auto.?crop|crop document|clean document|perspective/i.test(input)),
  execute:async({input,file})=>{if(!file)return null;const u=URL.createObjectURL(file);try{const img=await loadImage(u),q=await detectDocumentQuad(u);const page:ScanPage={id:crypto.randomUUID(),name:file.name,sourceUrl:u,width:img.naturalWidth,height:img.naturalHeight,quad:q,rotation:0,settings:{...DEFAULT_SETTINGS,mode:/black.?white/i.test(input)?'black-white':/gray|grey/i.test(input)?'grayscale':'color'}};const r=await processScanPage(page);return{text:`Document scan ready. Auto-cropped and perspective-corrected to ${r.width}×${r.height}px.`,blob:r.blob,fileName:outputFileName(file.name)}}finally{URL.revokeObjectURL(u)}}
}]}

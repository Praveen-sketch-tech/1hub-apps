export type OcrLanguage = 'hi' | 'en'
export type PageStatus = 'queued' | 'processing' | 'done' | 'error'
export interface OcrLine { text:string; score:number; poly:number[][] }
export interface DocumentDetection { type:string; confidence:number; matchedSignals:string[]; fields:Record<string,string> }
export interface DocumentPage {
  id:string; fileName:string; sourceFile:File; sourceUrl:string; colorBlob?:Blob; colorUrl?:string;
  width:number; height:number; rotation:number; status:PageStatus; progress:number; statusText:string;
  ocrText:string; ocrLines:OcrLine[]; averageConfidence:number; detection?:DocumentDetection; error?:string;
}

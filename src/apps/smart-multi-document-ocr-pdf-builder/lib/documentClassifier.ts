import type { DocumentDetection } from './types'
interface Rule{type:string;keywords:string[];patterns:Array<{label:string;regex:RegExp;weight:number}>}
const RULES:Rule[]=[
{type:'PAN Card',keywords:['income tax department','permanent account number','आयकर विभाग','स्थायी लेखा'],patterns:[{label:'PAN number',regex:/\b[A-Z]{5}[0-9]{4}[A-Z]\b/i,weight:45}]},
{type:'Aadhaar Card',keywords:['government of india','भारत सरकार','unique identification','आधार'],patterns:[{label:'Aadhaar number',regex:/\b(?:\d{4}[ -]?){2}\d{4}\b/,weight:38},{label:'Masked Aadhaar',regex:/\b(?:X{4}[ -]?){2}\d{4}\b/i,weight:38}]},
{type:'Bank Statement',keywords:['bank statement','account statement','opening balance','closing balance','debit','credit','ifsc'],patterns:[{label:'IFSC',regex:/\b[A-Z]{4}0[A-Z0-9]{6}\b/i,weight:28}]},
{type:'Salary Slip',keywords:['salary slip','pay slip','employee id','gross earnings','net pay','basic salary','hra','deductions'],patterns:[]},
{type:'Income Tax Return',keywords:['income tax return','assessment year','acknowledgement number','total income','tax payable','itr'],patterns:[]},
{type:'GST Document',keywords:['goods and services tax','gstin','gstr-1','gstr-3b','taxable value','cgst','sgst','igst'],patterns:[{label:'GSTIN',regex:/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/i,weight:35}]},
{type:'Driving Licence',keywords:['driving licence','driving license','transport department','licence no','dl no'],patterns:[{label:'Licence number',regex:/\b[A-Z]{2}[ -]?\d{2}[ -]?\d{4}[ -]?\d{7}\b/i,weight:34}]},
{type:'Voter ID',keywords:['election commission of india','elector photo identity card','मतदाता','निर्वाचन आयोग'],patterns:[{label:'EPIC number',regex:/\b[A-Z]{3}\d{7}\b/i,weight:35}]},
{type:'Passport',keywords:['republic of india','passport','nationality','place of birth','date of expiry'],patterns:[{label:'Passport number',regex:/\b[A-Z][0-9]{7}\b/i,weight:34}]},
{type:'Property Document',keywords:['sale deed','registry','registration deed','property','purchaser','vendor','plot no','survey no'],patterns:[]},
{type:'Invoice',keywords:['invoice','bill to','invoice no','total amount','tax invoice'],patterns:[]},
]
const FIELDS:Array<[string,RegExp]>=[['PAN',/\b[A-Z]{5}[0-9]{4}[A-Z]\b/i],['Aadhaar',/\b(?:\d{4}[ -]?){2}\d{4}\b/],['Masked Aadhaar',/\b(?:X{4}[ -]?){2}\d{4}\b/i],['DOB',/\b(?:0?[1-9]|[12]\d|3[01])[\/-](?:0?[1-9]|1[0-2])[\/-](?:19|20)\d{2}\b/],['IFSC',/\b[A-Z]{4}0[A-Z0-9]{6}\b/i],['GSTIN',/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/i],['PIN Code',/\b[1-9][0-9]{5}\b/]]
export function detectDocument(text:string):DocumentDetection{
  const normalized=text.toLowerCase().replace(/\s+/g,' ')
  let winner:DocumentDetection={type:'Other Document',confidence:20,matchedSignals:[],fields:{}}
  for(const rule of RULES){let score=0;const signals:string[]=[]
    for(const k of rule.keywords)if(normalized.includes(k.toLowerCase())){score+=13;signals.push(k)}
    for(const p of rule.patterns)if(p.regex.test(text)){score+=p.weight;signals.push(p.label)}
    if(Math.min(99,score)>winner.confidence)winner={type:rule.type,confidence:Math.min(99,score),matchedSignals:signals,fields:{}}
  }
  const fields:Record<string,string>={}
  for(const [label,pattern] of FIELDS){const m=text.match(pattern);if(m)fields[label]=m[0].replace(/\s+/g,' ').trim()}
  return{...winner,fields}
}

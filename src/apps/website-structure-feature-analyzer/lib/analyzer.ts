import type { AnalysisAccessMode, FeatureKind, FeatureNode, PageFeatureMap, WorkflowHint } from '../types/pageMap'

const PROCESS_WORDS = /compress|convert|generate|create|process|scan|analy[sz]e|resize|merge|split|export|run|start|submit|apply|enhance|record/i
const DOWNLOAD_WORDS = /download|save|export|get file/i
const UPLOAD_WORDS = /upload|choose file|select file|browse|drop file/i
const PREVIEW_WORDS = /preview|result|output|viewer/i
const CONFIG_WORDS = /quality|width|height|size|format|option|setting|ratio|resolution|mode/i

const clean = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim()
const safeId = (prefix: string, index: number) => `${prefix}-${index + 1}`

function selectorHint(el: Element) {
  const id = el.getAttribute('id')
  if (id) return `#${id}`
  const name = el.getAttribute('name')
  if (name) return `${el.tagName.toLowerCase()}[name="${name.replace(/"/g, '\\"')}"]`
  const role = el.getAttribute('role')
  if (role) return `${el.tagName.toLowerCase()}[role="${role}"]`
  return el.tagName.toLowerCase()
}

function elementLabel(el: Element) {
  const aria = clean(el.getAttribute('aria-label'))
  if (aria) return aria
  const labelled = clean(el.getAttribute('title'))
  if (labelled) return labelled
  const placeholder = clean(el.getAttribute('placeholder'))
  if (placeholder) return placeholder
  const value = clean(el.getAttribute('value'))
  if (value && ['button', 'submit', 'reset'].includes((el.getAttribute('type') || '').toLowerCase())) return value
  return clean(el.textContent) || clean(el.getAttribute('name')) || clean(el.getAttribute('id')) || el.tagName.toLowerCase()
}

function baseFeature(el: Element, kind: FeatureKind, id: string, label?: string): FeatureNode {
  const attrs: Record<string, string> = {}
  for (const key of ['name', 'role', 'aria-label', 'placeholder', 'download', 'accept']) {
    const value = el.getAttribute(key)
    if (value) attrs[key] = value
  }
  return {
    id,
    kind,
    label: clean(label) || elementLabel(el),
    selectorHint: selectorHint(el),
    tagName: el.tagName.toLowerCase(),
    disabled: 'disabled' in el ? Boolean((el as HTMLInputElement).disabled) : undefined,
    required: 'required' in el ? Boolean((el as HTMLInputElement).required) : undefined,
    attributes: Object.keys(attrs).length ? attrs : undefined,
  }
}

function pushElements(features: FeatureNode[], doc: Document, selector: string, kind: FeatureKind, prefix: string) {
  Array.from(doc.querySelectorAll(selector)).forEach((el, index) => features.push(baseFeature(el, kind, safeId(prefix, index))))
}

function dedupeFeatures(features: FeatureNode[]) {
  const seen = new Set<string>()
  return features.filter((feature) => {
    const key = `${feature.kind}|${feature.selectorHint}|${feature.label}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function detectWorkflow(features: FeatureNode[]): WorkflowHint[] {
  const buckets: Record<WorkflowHint['role'], string[]> = { input: [], configure: [], process: [], preview: [], download: [], navigation: [], unknown: [] }
  for (const feature of features) {
    const text = `${feature.label} ${feature.inputType || ''}`
    if (feature.kind === 'file-upload' || UPLOAD_WORDS.test(text)) buckets.input.push(feature.id)
    else if (feature.kind === 'download' || DOWNLOAD_WORDS.test(text)) buckets.download.push(feature.id)
    else if ((feature.kind === 'button' || feature.kind === 'primary-cta') && PROCESS_WORDS.test(text)) buckets.process.push(feature.id)
    else if (feature.kind === 'input' || feature.kind === 'select' || feature.kind === 'textarea' || CONFIG_WORDS.test(text)) buckets.configure.push(feature.id)
    else if (PREVIEW_WORDS.test(text)) buckets.preview.push(feature.id)
    else if (feature.kind === 'link' || feature.kind === 'tab') buckets.navigation.push(feature.id)
  }
  const labels: Record<WorkflowHint['role'], string> = { input:'Provide input', configure:'Configure options', process:'Run primary action', preview:'Preview result', download:'Download output', navigation:'Navigate', unknown:'Other' }
  return (Object.keys(buckets) as WorkflowHint['role'][]).filter((role) => buckets[role].length).map((role, i) => ({
    id: `workflow-${i + 1}`, label: labels[role], role, featureIds: buckets[role], confidence: role === 'unknown' ? 0.4 : 0.78,
  }))
}

function countSummary(features: FeatureNode[]) {
  const count = (kind: FeatureKind) => features.filter((f) => f.kind === kind).length
  return {
    headings: count('heading'), buttons: count('button'), links: count('link'), forms: count('form'), inputs: count('input'),
    textareas: count('textarea'), selects: count('select'), tabs: count('tab'), fileUploads: count('file-upload'),
    downloads: count('download'), primaryCtas: count('primary-cta'), sections: count('section'),
  }
}

export function analyzeDocument(doc: Document, options: { url?: string; mode?: AnalysisAccessMode } = {}): PageFeatureMap {
  const features: FeatureNode[] = []
  pushElements(features, doc, 'h1,h2,h3,h4,h5,h6', 'heading', 'heading')
  pushElements(features, doc, 'button,input[type="button"],input[type="submit"],input[type="reset"]', 'button', 'button')
  pushElements(features, doc, 'a[href]', 'link', 'link')
  pushElements(features, doc, 'form', 'form', 'form')
  pushElements(features, doc, 'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"])', 'input', 'input')
  pushElements(features, doc, 'textarea', 'textarea', 'textarea')
  pushElements(features, doc, 'select', 'select', 'select')
  pushElements(features, doc, '[role="tab"],[aria-selected][role]', 'tab', 'tab')
  pushElements(features, doc, 'section,main,article,[role="region"]', 'section', 'section')

  Array.from(doc.querySelectorAll('input[type="file"]')).forEach((el, i) => {
    const item = baseFeature(el, 'file-upload', safeId('upload', i))
    item.inputType = 'file'; item.confidence = 1
    features.push(item)
  })
  Array.from(doc.querySelectorAll('input')).forEach((el) => {
    const found = features.find((f) => f.selectorHint === selectorHint(el) && f.kind === 'input')
    if (found) found.inputType = (el.getAttribute('type') || 'text').toLowerCase()
  })
  Array.from(doc.querySelectorAll('a[download],a[href],button')).forEach((el, i) => {
    const label = elementLabel(el)
    const href = el.getAttribute('href') || undefined
    if (el.hasAttribute('download') || DOWNLOAD_WORDS.test(`${label} ${href || ''}`)) {
      const item = baseFeature(el, 'download', safeId('download', i), label); item.href = href; item.confidence = el.hasAttribute('download') ? 1 : 0.8; features.push(item)
    }
  })
  Array.from(doc.querySelectorAll('button,a,[role="button"],input[type="submit"]')).forEach((el, i) => {
    const label = elementLabel(el)
    if (PROCESS_WORDS.test(label)) { const item = baseFeature(el, 'primary-cta', safeId('cta', i), label); item.confidence = 0.82; features.push(item) }
  })
  Array.from(doc.querySelectorAll('label,legend')).forEach((el, i) => {
    const label = elementLabel(el); if (label) features.push(baseFeature(el, 'label', safeId('label', i), label))
  })

  const finalFeatures = dedupeFeatures(features)
  const labelCounts = new Map<string, number>()
  finalFeatures.forEach((f) => { const key=f.label.toLowerCase(); if(key.length>2) labelCounts.set(key,(labelCounts.get(key)||0)+1) })
  const repeatedLabels = Array.from(labelCounts.entries()).filter(([,count])=>count>1).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,20)
  const url = options.url || doc.baseURI || undefined
  let origin: string | undefined
  try { if (url) origin = new URL(url).origin } catch {}
  const mode = options.mode || 'pasted-html'
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: { title: clean(doc.title) || undefined, url, origin, mode },
    access: { mode, directDomAccess: mode === 'same-origin-document', sourceAvailable: true },
    summary: countSummary(finalFeatures),
    features: finalFeatures,
    workflowHints: detectWorkflow(finalFeatures),
    repeatedLabels,
    notes: ['Rule-based analysis only; no AI inference is required.', 'Selectors are hints for downstream modules and are not guaranteed stable on dynamically changing pages.'],
  }
}

export function analyzeHtml(html: string, options: { url?: string; mode?: AnalysisAccessMode } = {}) {
  if (!html.trim()) throw new Error('HTML source is empty.')
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return analyzeDocument(doc, { url: options.url, mode: options.mode || 'pasted-html' })
}

export function createFallbackAnalysis(url: string, mode: 'cross-origin-unavailable' | 'snapshot-ready' | 'visual-capture-fallback', reason: string): PageFeatureMap {
  return {
    version: 1, generatedAt: new Date().toISOString(), source: { url, mode },
    access: {
      mode, directDomAccess: false, sourceAvailable: false, reason,
      nextBestMode: mode === 'cross-origin-unavailable' ? 'paste-html' : mode === 'snapshot-ready' ? 'snapshot-local-simulation' : 'visual-capture',
    },
    summary: { headings:0,buttons:0,links:0,forms:0,inputs:0,textareas:0,selects:0,tabs:0,fileUploads:0,downloads:0,primaryCtas:0,sections:0 },
    features: [], workflowHints: [], repeatedLabels: [],
    notes: ['The browser did not provide analyzable page source. No cross-origin security boundary was bypassed.', 'Downstream orchestrators can route this result to pasted HTML, snapshot/local simulation, or user-permitted visual capture.'],
  }
}

export async function probeUrlAccessibility(url: string): Promise<PageFeatureMap> {
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error('Enter a valid absolute URL including http:// or https://.') }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Only HTTP(S) URLs are supported for URL analysis.')
  try {
    const response = await fetch(parsed.toString(), { method: 'GET', credentials: 'omit' })
    if (!response.ok) return createFallbackAnalysis(url, 'cross-origin-unavailable', `The URL returned HTTP ${response.status}.`)
    const type = response.headers.get('content-type') || ''
    if (!type.includes('text/html')) return createFallbackAnalysis(url, 'cross-origin-unavailable', `The accessible response is not HTML (${type || 'unknown content type'}).`)
    const html = await response.text()
    const result = analyzeHtml(html, { url, mode: 'url-fetch-accessible' })
    result.access = { mode: 'url-fetch-accessible', directDomAccess: false, sourceAvailable: true, reason: 'The server allowed a browser fetch of its HTML response.' }
    return result
  } catch {
    return createFallbackAnalysis(url, 'cross-origin-unavailable', 'Direct browser fetch was blocked or unavailable, commonly because of CORS, network policy, authentication, or browser security restrictions.')
  }
}

export function summarizeFeatureMap(map: PageFeatureMap) {
  const s = map.summary
  return `${map.source.title ? `${map.source.title}: ` : ''}${s.headings} headings, ${s.buttons} buttons, ${s.inputs} inputs, ${s.fileUploads} file uploads, ${s.primaryCtas} primary CTAs, ${s.downloads} download controls. Access mode: ${map.access.mode}.`
}

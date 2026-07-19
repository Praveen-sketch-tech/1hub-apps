import { useMemo, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { analyzeHtml, probeUrlAccessibility, summarizeFeatureMap } from './lib/analyzer'
import type { PageFeatureMap } from './types/pageMap'
import './WebsiteStructureFeatureAnalyzer.css'

const SAMPLE_HTML = `<!doctype html>
<html><head><title>Smart Image Tool</title></head><body>
<main><h1>Smart Image Compressor</h1><p>Compress images locally.</p>
<form><label>Upload image</label><input type="file" accept="image/*">
<label>Quality</label><input name="quality" type="range"><select name="format"><option>WebP</option></select>
<button type="submit">Compress Image</button></form>
<section><h2>Preview Result</h2><a href="output.webp" download>Download Image</a></section></main>
</body></html>`

export function WebsiteStructureFeatureAnalyzerPage() {
  const [mode, setMode] = useState<'html' | 'url'>('html')
  const [html, setHtml] = useState(SAMPLE_HTML)
  const [url, setUrl] = useState('')
  const [result, setResult] = useState<PageFeatureMap | null>(null)
  const [status, setStatus] = useState('Paste accessible HTML or try a URL capability check.')
  const [busy, setBusy] = useState(false)
  const summary = useMemo(() => result ? summarizeFeatureMap(result) : '', [result])

  const analyzeSource = () => {
    try {
      const map = analyzeHtml(html, { url: url || undefined, mode: 'pasted-html' })
      setResult(map); setStatus('Structured Page Map / Feature Map generated locally.')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Analysis failed.') }
  }

  const analyzeUrl = async () => {
    setBusy(true); setStatus('Checking whether the browser can access this URL response…')
    try {
      const map = await probeUrlAccessibility(url)
      setResult(map)
      setStatus(map.access.sourceAvailable ? 'URL HTML was accessible and analyzed.' : map.access.reason || 'Direct URL analysis is unavailable.')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'URL analysis failed.') }
    finally { setBusy(false) }
  }

  const loadFile = async (file?: File) => {
    if (!file) return
    if (!/\.html?$/i.test(file.name) && !/text\/html/i.test(file.type)) { setStatus('Choose an HTML/HTM file.'); return }
    const text = await file.text(); setHtml(text); setMode('html');
    try { const map = analyzeHtml(text, { url: file.name, mode: 'local-file' }); setResult(map); setStatus('Local HTML file analyzed.'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not analyze the file.') }
  }

  const exportJson = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = 'page-feature-map.json'; a.click(); setTimeout(() => URL.revokeObjectURL(href), 5000)
  }

  return <div className="tool-page wsfa-page">
    <ToolAppHeader appNumber="021" title="Website Structure & Feature Analyzer" description="Analyze accessible page data into reusable structured Page Maps and Feature Maps using browser-local rules." />

    <div className="wsfa-modebar">
      <button className={mode==='html'?'active':''} onClick={()=>setMode('html')}>HTML / Page Source</button>
      <button className={mode==='url'?'active':''} onClick={()=>setMode('url')}>URL Capability Check</button>
    </div>

    <div className="wsfa-grid">
      <section className="wsfa-card">
        <div className="wsfa-head"><div><h2>Analysis Input</h2><p>Only data the browser can legitimately access is analyzed.</p></div><span className="wsfa-pill">Rules-based</span></div>
        {mode==='html' ? <>
          <textarea value={html} onChange={(e)=>setHtml(e.target.value)} spellCheck={false} aria-label="HTML page source" />
          <div className="wsfa-actions"><button onClick={analyzeSource}>Analyze HTML</button><label className="wsfa-file">Open HTML file<input type="file" accept=".html,.htm,text/html" onChange={(e)=>void loadFile(e.target.files?.[0])}/></label></div>
        </> : <>
          <input className="wsfa-url" value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://example.com" inputMode="url" />
          <div className="wsfa-notice"><strong>Browser security boundary:</strong> a normal web app cannot freely inspect arbitrary cross-origin DOMs. This check only analyzes HTML when the target server permits browser fetch access; otherwise it returns a structured fallback state.</div>
          <div className="wsfa-actions"><button onClick={()=>void analyzeUrl()} disabled={busy || !url.trim()}>{busy?'Checking…':'Check & Analyze URL'}</button></div>
        </>}
        <p className="wsfa-status">{status}</p>
      </section>

      <section className="wsfa-card">
        <div className="wsfa-head"><div><h2>Structured Result</h2><p>Designed for App #023 Demo Flow Builder and future orchestrators.</p></div>{result&&<button className="wsfa-small" onClick={exportJson}>Export JSON</button>}</div>
        {!result ? <div className="wsfa-empty">Run an analysis to generate a Page Map / Feature Map.</div> : <>
          <p className="wsfa-summary">{summary}</p>
          <div className="wsfa-stats">{Object.entries(result.summary).map(([k,v])=><div key={k}><strong>{v}</strong><span>{k}</span></div>)}</div>
          <div className={`wsfa-access ${result.access.sourceAvailable?'ok':'warn'}`}><strong>{result.access.mode}</strong><span>{result.access.sourceAvailable?'Analyzable source available':result.access.reason}</span>{result.access.nextBestMode&&<em>Next: {result.access.nextBestMode}</em>}</div>
        </>}
      </section>
    </div>

    {result && <div className="wsfa-grid wsfa-lower">
      <section className="wsfa-card"><h2>Detected Features</h2><div className="wsfa-feature-list">{result.features.slice(0,120).map(f=><div className="wsfa-feature" key={f.id}><span className="wsfa-kind">{f.kind}</span><strong>{f.label}</strong><code>{f.selectorHint}</code></div>)}{!result.features.length&&<p>No DOM features available in this fallback result.</p>}</div></section>
      <section className="wsfa-card"><h2>Workflow Hints</h2><div className="wsfa-flow">{result.workflowHints.map(h=><div key={h.id}><span>{h.role}</span><strong>{h.label}</strong><small>{h.featureIds.length} mapped features · {Math.round(h.confidence*100)}% rule confidence</small></div>)}{!result.workflowHints.length&&<p>Workflow hints require analyzable page structure.</p>}</div><h3>Fallback-ready contract</h3><p className="wsfa-muted">The access object explicitly distinguishes direct/analyzable content from cross-origin unavailable content and exposes the next-best mode for App #022 snapshot/local simulation or App #025 visual capture.</p></section>
    </div>}
  </div>
}

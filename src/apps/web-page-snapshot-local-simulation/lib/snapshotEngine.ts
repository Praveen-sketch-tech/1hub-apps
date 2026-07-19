import type {
  CreateSnapshotInput,
  SimulationTargetDescriptor,
  SnapshotCapabilityResult,
  SnapshotPageMap,
  SnapshotPageMapElement,
  SnapshotProject,
} from '../types/snapshot'

const nowIso = () => new Date().toISOString()

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#039;')

const labelOf = (value: string | SnapshotPageMapElement | undefined, fallback = '') => {
  if (typeof value === 'string') return value
  return value?.label || value?.text || value?.name || fallback
}

export function detectSnapshotCapabilities(): SnapshotCapabilityResult {
  return {
    indexedDb: typeof indexedDB !== 'undefined',
    blobUrl: typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function',
    opfs:
      typeof navigator !== 'undefined' &&
      !!navigator.storage &&
      typeof navigator.storage.getDirectory === 'function',
  }
}

export function sanitizeSnapshotHtml(html: string): { html: string; warnings: string[] } {
  if (!html.trim()) {
    return {
      html: createFallbackDocument('Empty snapshot', 'No HTML content was supplied.'),
      warnings: ['No HTML content was supplied.'],
    }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const warnings: string[] = []

  doc.querySelectorAll('script, iframe, object, embed, base, portal').forEach((node) => {
    node.remove()
    warnings.push(`Removed unsafe or unsupported <${node.tagName.toLowerCase()}> element.`)
  })

  doc.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()

      if (name.startsWith('on')) {
        element.removeAttribute(attr.name)
        return
      }

      if (
        (name === 'href' || name === 'src' || name === 'action' || name === 'formaction') &&
        (value.startsWith('javascript:') || value.startsWith('data:text/html'))
      ) {
        element.removeAttribute(attr.name)
        warnings.push(`Removed unsafe ${name} URL.`)
      }
    })
  })

  const hasDoctype = /^\s*<!doctype/i.test(html)
  const serialized = doc.documentElement.outerHTML
  return {
    html: `${hasDoctype ? '<!doctype html>\n' : '<!doctype html>\n'}${serialized}`,
    warnings: [...new Set(warnings)],
  }
}

function createFallbackDocument(title: string, message: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color-scheme: light dark; }
  body { margin: 0; padding: 32px; background: Canvas; color: CanvasText; }
  .card { max-width: 760px; margin: 0 auto; padding: 24px; border: 1px solid color-mix(in srgb, CanvasText 16%, transparent); border-radius: 18px; }
</style>
</head>
<body>
  <main class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </main>
</body>
</html>`
}

function renderInput(element: SnapshotPageMapElement, index: number) {
  const type = element.inputType || 'text'
  const label = labelOf(element, `Input ${index + 1}`)
  if (type === 'file') {
    return `<label class="field"><span>${escapeHtml(label)}</span><input type="file" data-snapshot-control="file-upload" /></label>`
  }
  return `<label class="field"><span>${escapeHtml(label)}</span><input type="${escapeHtml(type)}" name="${escapeHtml(element.name || '')}" placeholder="${escapeHtml(label)}" /></label>`
}

export function renderPageMapAsHtml(pageMap: SnapshotPageMap): string {
  const title = pageMap.title || 'Local Page Simulation'
  const headings = (pageMap.headings || []).map((item) => labelOf(item)).filter(Boolean)
  const buttons = (pageMap.buttons || []).map((item) => labelOf(item, 'Action')).filter(Boolean)
  const links = (pageMap.links || []).map((item) => labelOf(item, 'Link')).filter(Boolean)
  const inputs = pageMap.inputs || []
  const uploads = pageMap.fileUploads || []
  const selects = pageMap.selects || []
  const textareas = pageMap.textareas || []
  const featureLabels = pageMap.featureLabels || []
  const workflowHints = pageMap.workflowHints || []

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #f7f7fb; color: #16181d; }
  .shell { max-width: 1040px; margin: 0 auto; padding: 28px; }
  .hero, .panel { background: white; border: 1px solid #e6e8ef; border-radius: 18px; padding: 22px; margin-bottom: 18px; }
  .grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit,minmax(210px,1fr)); }
  .field { display: grid; gap: 7px; }
  input,select,textarea,button { font: inherit; }
  input,select,textarea { width: 100%; padding: 11px 12px; border: 1px solid #cfd3dc; border-radius: 10px; background: white; color: #16181d; }
  button,.cta { display:inline-flex; align-items:center; justify-content:center; padding:11px 16px; border:0; border-radius:10px; background:#252a34; color:white; text-decoration:none; cursor:pointer; margin:4px; }
  .chip { display:inline-block; padding:6px 10px; border-radius:999px; background:#eef0f6; margin:4px; }
  .note { color:#626775; }
</style>
</head>
<body>
  <main class="shell" data-snapshot-root="true">
    <section class="hero">
      <h1>${escapeHtml(headings[0] || title)}</h1>
      <p class="note">Generated from a structured Page Map / Feature Map for browser-local simulation.</p>
      ${featureLabels.map((x) => `<span class="chip">${escapeHtml(x)}</span>`).join('')}
    </section>
    <section class="panel">
      <h2>Controls</h2>
      <div class="grid">
        ${inputs.map(renderInput).join('')}
        ${uploads.map(renderInput).join('')}
        ${textareas.map((x, i) => `<label class="field"><span>${escapeHtml(labelOf(x, `Textarea ${i + 1}`))}</span><textarea rows="4"></textarea></label>`).join('')}
        ${selects.map((x, i) => `<label class="field"><span>${escapeHtml(labelOf(x, `Select ${i + 1}`))}</span><select>${(x.options || ['Option 1','Option 2']).map((o) => `<option>${escapeHtml(o)}</option>`).join('')}</select></label>`).join('')}
      </div>
    </section>
    <section class="panel">
      <h2>Actions</h2>
      ${buttons.map((x) => `<button type="button" data-snapshot-action="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('')}
      ${links.map((x) => `<a class="cta" href="#" data-snapshot-link="${escapeHtml(x)}">${escapeHtml(x)}</a>`).join('')}
    </section>
    ${workflowHints.length ? `<section class="panel"><h2>Workflow hints</h2><ol>${workflowHints.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ol></section>` : ''}
  </main>
</body>
</html>`
}

export function createSnapshotProject(input: CreateSnapshotInput): SnapshotProject {
  const createdAt = nowIso()
  const accessMode = input.accessMode ?? (input.pageMap ? 'page-map' : 'user-html')
  const rawHtml = input.html?.trim()
    ? input.html
    : input.pageMap
      ? renderPageMapAsHtml(input.pageMap)
      : createFallbackDocument(
          input.title || 'Snapshot source required',
          'Provide accessible HTML, an HTML file, or a structured Page Map to create a local simulation.',
        )

  const sanitized = sanitizeSnapshotHtml(rawHtml)

  return {
    version: 1,
    id: uid(),
    name: input.name?.trim() || input.title?.trim() || 'Untitled Snapshot',
    createdAt,
    updatedAt: createdAt,
    metadata: {
      sourceUrl: input.sourceUrl?.trim() || input.pageMap?.sourceUrl || input.pageMap?.url,
      title: input.title?.trim() || input.pageMap?.title,
      capturedAt: createdAt,
      accessMode,
      notes: input.notes,
    },
    sanitizedHtml: sanitized.html,
    pageMap: input.pageMap,
    fallbackMode: input.html?.trim() || input.pageMap ? 'none' : 'source-required',
    warnings: sanitized.warnings,
  }
}

export function updateSnapshotProject(
  project: SnapshotProject,
  patch: Partial<Pick<SnapshotProject, 'name' | 'sanitizedHtml' | 'pageMap'>>,
): SnapshotProject {
  const html = patch.sanitizedHtml ?? project.sanitizedHtml
  const sanitized = sanitizeSnapshotHtml(html)

  return {
    ...project,
    ...patch,
    sanitizedHtml: sanitized.html,
    updatedAt: nowIso(),
    warnings: [...new Set([...project.warnings, ...sanitized.warnings])],
  }
}

export function exportSnapshotProject(project: SnapshotProject): Blob {
  return new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
}

export function parseSnapshotProject(text: string): SnapshotProject {
  const value = JSON.parse(text) as Partial<SnapshotProject>
  if (
    value.version !== 1 ||
    !value.id ||
    !value.name ||
    !value.metadata ||
    typeof value.sanitizedHtml !== 'string'
  ) {
    throw new Error('Invalid snapshot project JSON.')
  }

  const sanitized = sanitizeSnapshotHtml(value.sanitizedHtml)

  return {
    ...value,
    version: 1,
    id: value.id,
    name: value.name,
    createdAt: value.createdAt || nowIso(),
    updatedAt: nowIso(),
    metadata: {
      capturedAt: value.metadata.capturedAt || nowIso(),
      accessMode: value.metadata.accessMode || 'imported-project',
      sourceUrl: value.metadata.sourceUrl,
      title: value.metadata.title,
      notes: value.metadata.notes,
    },
    sanitizedHtml: sanitized.html,
    fallbackMode: value.fallbackMode || 'none',
    warnings: [...new Set([...(value.warnings || []), ...sanitized.warnings])],
  }
}

export function parsePageMap(text: string): SnapshotPageMap {
  const value = JSON.parse(text) as SnapshotPageMap
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Page Map must be a JSON object.')
  }
  return value
}

export function createPreviewBlobUrl(project: SnapshotProject): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Blob URL previews are not supported in this browser.')
  }
  const blob = new Blob([project.sanitizedHtml], { type: 'text/html' })
  return URL.createObjectURL(blob)
}

export function revokePreviewBlobUrl(url: string | null | undefined) {
  if (url && typeof URL !== 'undefined') URL.revokeObjectURL(url)
}

export function createSimulationTarget(project: SnapshotProject): SimulationTargetDescriptor {
  return {
    projectId: project.id,
    kind: 'local-snapshot',
    html: project.sanitizedHtml,
    sourceUrl: project.metadata.sourceUrl,
    pageMap: project.pageMap,
  }
}

export async function fetchAccessibleHtml(url: string): Promise<{
  ok: boolean
  html?: string
  finalUrl?: string
  status?: number
  fallbackMode: 'none' | 'source-required' | 'snapshot-required' | 'visual-capture-required'
  message: string
}> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return {
      ok: false,
      fallbackMode: 'source-required',
      message: 'Enter a valid http(s) URL.',
    }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      ok: false,
      fallbackMode: 'source-required',
      message: 'Only http(s) URLs are supported.',
    }
  }

  try {
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      credentials: 'omit',
      redirect: 'follow',
    })

    const contentType = response.headers.get('content-type') || ''
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        finalUrl: response.url,
        fallbackMode: 'snapshot-required',
        message: `The page returned HTTP ${response.status}. Provide accessible HTML/page source or use a later snapshot/capture fallback.`,
      }
    }

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return {
        ok: false,
        status: response.status,
        finalUrl: response.url,
        fallbackMode: 'source-required',
        message: `The URL did not return HTML (${contentType || 'unknown content type'}).`,
      }
    }

    return {
      ok: true,
      html: await response.text(),
      status: response.status,
      finalUrl: response.url,
      fallbackMode: 'none',
      message: 'HTML was accessible to this browser and can be imported locally.',
    }
  } catch {
    return {
      ok: false,
      fallbackMode: 'visual-capture-required',
      message:
        'Direct browser fetch was blocked or unavailable, commonly because of cross-origin/CORS restrictions. Paste or upload legitimately accessible HTML, or use the future snapshot/visual-capture fallback path.',
    }
  }
}

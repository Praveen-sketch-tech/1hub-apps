import {
  BINARY_EXTENSIONS,
  DestinationPlan,
  EntryDetection,
  MAX_FILE_SIZE_BYTES,
  ProjectType,
  SERVER_SIDE_EXTENSIONS,
  SlugValidationResult,
  UploadedFile,
} from '../types'

// ---------------------------------------------------------------------------
// Path handling
// ---------------------------------------------------------------------------

/**
 * Normalizes a raw relative path (from webkitRelativePath, a dropped folder
 * entry's fullPath, etc.) into a safe, forward-slash repo-relative path.
 * Returns null when the path is unsafe (traversal, absolute, empty).
 */
export function normalizeRelativePath(rawPath: string): string | null {
  if (!rawPath) return null

  let normalized = rawPath.replace(/\\/g, '/').trim()

  // Strip a single leading "./" and any leading slashes.
  normalized = normalized.replace(/^\.\//, '').replace(/^\/+/, '')

  if (!normalized) return null

  const segments = normalized.split('/').filter((segment) => segment.length > 0)

  if (segments.length === 0) return null

  for (const segment of segments) {
    if (segment === '..' || segment === '.') return null
    // Reject control characters and characters that are unsafe in a repo path.
    for (let i = 0; i < segment.length; i++) {
      if (segment.charCodeAt(i) <= 0x1f) return null
    }
  }

  return segments.join('/')
}

export function getExtension(path: string): string {
  const base = path.split('/').pop() ?? path
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

export function isBinaryPath(path: string): boolean {
  return BINARY_EXTENSIONS.has(getExtension(path))
}

export function isHtmlPath(path: string): boolean {
  const ext = getExtension(path)
  return ext === 'html' || ext === 'htm'
}

// ---------------------------------------------------------------------------
// Slug validation
// ---------------------------------------------------------------------------

const SLUG_PATTERN = /^[a-z0-9_-]+$/

export function validateSlug(raw: string): SlugValidationResult {
  const trimmed = raw.trim().toLowerCase()

  if (!trimmed) {
    return { valid: false, normalized: '', error: 'URL name cannot be empty.' }
  }

  if (trimmed.includes('..')) {
    return { valid: false, normalized: '', error: 'URL name cannot contain ".."' }
  }

  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return { valid: false, normalized: '', error: 'URL name cannot contain slashes.' }
  }

  if (/\s/.test(trimmed)) {
    return { valid: false, normalized: '', error: 'URL name cannot contain spaces.' }
  }

  // Normalize: replace anything that isn't a-z0-9_- with a hyphen, then collapse.
  const normalized = trimmed
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!normalized) {
    return { valid: false, normalized: '', error: 'URL name must contain at least one letter or number.' }
  }

  if (!SLUG_PATTERN.test(normalized)) {
    return { valid: false, normalized: '', error: 'URL name can only contain a-z, 0-9, hyphen and underscore.' }
  }

  return { valid: true, normalized }
}

// ---------------------------------------------------------------------------
// Project type + entry detection
// ---------------------------------------------------------------------------

export function detectProjectType(files: UploadedFile[]): ProjectType {
  if (files.length === 1 && isHtmlPath(files[0].path)) {
    return 'single-html'
  }
  return 'multi-file'
}

export function detectHtmlEntry(files: UploadedFile[]): EntryDetection {
  const htmlFiles = files.filter((f) => isHtmlPath(f.path)).map((f) => f.path)

  // Prefer an index.html/index.htm that sits at the shallowest depth.
  const indexCandidates = htmlFiles
    .filter((p) => /(^|\/)index\.html?$/i.test(p))
    .sort((a, b) => a.split('/').length - b.split('/').length)

  if (indexCandidates.length > 0) {
    return { entryPath: indexCandidates[0], htmlFiles, needsSelection: false }
  }

  if (htmlFiles.length === 1) {
    return { entryPath: htmlFiles[0], htmlFiles, needsSelection: false }
  }

  if (htmlFiles.length === 0) {
    return { entryPath: null, htmlFiles, needsSelection: false }
  }

  return { entryPath: null, htmlFiles, needsSelection: true }
}

export function detectServerSideFiles(files: UploadedFile[]): string[] {
  return files
    .filter((f) => SERVER_SIDE_EXTENSIONS.includes(getExtension(f.path)))
    .map((f) => f.path)
}

export function detectOversizedFiles(files: UploadedFile[]): { path: string; size: number }[] {
  return files
    .filter((f) => f.file.size > MAX_FILE_SIZE_BYTES)
    .map((f) => ({ path: f.path, size: f.file.size }))
}

export function detectDuplicatePaths(files: UploadedFile[]): string[] {
  const seen = new Map<string, number>()
  for (const f of files) {
    const key = f.path.toLowerCase()
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([path]) => path)
}

/**
 * Best-effort scan for local <link href>/<script src>/<img src> references
 * inside uploaded HTML/CSS text files that don't resolve to any uploaded file.
 * Only warns; never blocks publishing.
 */
export async function findBrokenLocalReferences(files: UploadedFile[]): Promise<string[]> {
  const pathSet = new Set(files.map((f) => f.path))
  const warnings: string[] = []

  const referencePattern = /(?:href|src)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)/gi

  for (const f of files) {
    const ext = getExtension(f.path)
    if (ext !== 'html' && ext !== 'htm' && ext !== 'css') continue

    let text: string
    try {
      text = await f.file.text()
    } catch {
      continue
    }

    const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : ''

    for (const match of text.matchAll(referencePattern)) {
      const ref = (match[1] || match[2] || '').trim()
      if (!ref) continue
      if (/^(https?:)?\/\//i.test(ref)) continue
      if (ref.startsWith('data:') || ref.startsWith('mailto:') || ref.startsWith('#') || ref.startsWith('tel:')) continue

      const resolved = resolveRelativePath(dir, ref.split('#')[0].split('?')[0])
      if (resolved && !pathSet.has(resolved)) {
        warnings.push(`${f.path} references missing file "${ref}"`)
      }
    }
  }

  return warnings
}

export function resolveRelativePath(fromDir: string, ref: string): string | null {
  if (!ref) return null
  const cleaned = ref.replace(/\\/g, '/')
  const baseSegments = cleaned.startsWith('/') ? [] : fromDir.split('/').filter(Boolean)
  const refSegments = cleaned.replace(/^\/+/, '').split('/').filter(Boolean)

  const stack = [...baseSegments]
  for (const segment of refSegments) {
    if (segment === '.') continue
    if (segment === '..') {
      if (stack.length === 0) return null
      stack.pop()
      continue
    }
    stack.push(segment)
  }

  return stack.join('/') || null
}

// ---------------------------------------------------------------------------
// Destination planning
// ---------------------------------------------------------------------------

export function planDestination(
  files: UploadedFile[],
  slug: string,
  entryPath: string | null,
): DestinationPlan {
  const origin = window.location.origin
  const projectType = detectProjectType(files)

  if (projectType === 'single-html') {
    const basePath = `public/${slug}.html`
    return {
      projectType,
      basePath,
      liveUrl: `${origin}/${slug}.html`,
      entries: [{ repoPath: basePath, sourceFile: files[0].file }],
    }
  }

  const basePath = `public/${slug}`
  const entries: { repoPath: string; sourceFile: File }[] = files.map((f) => ({
    repoPath: `${basePath}/${f.path}`,
    sourceFile: f.file,
  }))

  // If the detected entry isn't literally "index.html" at the project root,
  // publish an additional copy at the root as index.html without touching
  // or removing the original file, so the folder URL (…/slug/) resolves.
  if (entryPath && entryPath.toLowerCase() !== 'index.html') {
    const entryFile = files.find((f) => f.path === entryPath)
    if (entryFile) {
      entries.push({ repoPath: `${basePath}/index.html`, sourceFile: entryFile.file })
    }
  }

  return {
    projectType,
    basePath,
    liveUrl: `${origin}/${slug}/`,
    entries,
  }
}

import { UploadedFile } from '../types'
import { getExtension, resolveRelativePath } from './project'

export interface PreviewBuild {
  /** Blob URL to load into the preview iframe (the rewritten entry HTML). */
  url: string
  /** Call when the preview is no longer needed, to release all object URLs. */
  revoke: () => void
}

const HTML_ATTR_PATTERN = /((?:href|src)\s*=\s*)(["'])([^"']*)\2/gi
const CSS_URL_PATTERN = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi

function isSkippableRef(ref: string): boolean {
  if (!ref) return true
  if (/^(https?:)?\/\//i.test(ref)) return true
  if (/^(data:|blob:|mailto:|tel:|#|javascript:)/i.test(ref)) return true
  return false
}

/**
 * Builds an in-memory map of repo-relative path -> Blob object URL for every
 * uploaded file, rewrites local references inside HTML and CSS text files to
 * point at those blob URLs, and returns a single entry-point blob URL ready
 * to load into a sandboxed iframe. Nothing here touches the real DOM or
 * executes uploaded script; it is pure string/blob assembly.
 */
export async function buildPreview(files: UploadedFile[], entryPath: string): Promise<PreviewBuild> {
  const createdUrls: string[] = []

  // Pass 1: create a raw blob URL for every non-HTML/CSS asset (images,
  // fonts, plain JS, etc. — these don't need text rewriting).
  const rawAssetUrls = new Map<string, string>()
  for (const f of files) {
    const ext = getExtension(f.path)
    if (ext === 'html' || ext === 'htm' || ext === 'css') continue
    const url = URL.createObjectURL(f.file)
    createdUrls.push(url)
    rawAssetUrls.set(f.path, url)
  }

  // Pass 2: rewrite CSS files' url(...) references, then blob them.
  const cssUrls = new Map<string, string>()
  const filesByPath = new Map(files.map((f) => [f.path, f]))

  for (const f of files) {
    if (getExtension(f.path) !== 'css') continue
    const dir = dirOf(f.path)
    let text = await f.file.text()

    text = await replaceAsync(text, CSS_URL_PATTERN, async (_match, _quote, ref) => {
      if (isSkippableRef(ref)) return _match
      const resolved = resolveRelativePath(dir, ref.split('#')[0].split('?')[0])
      const url = resolved ? await resolveAssetUrl(resolved, filesByPath, rawAssetUrls, cssUrls, createdUrls) : null
      return url ? `url("${url}")` : _match
    })

    const blob = new Blob([text], { type: 'text/css' })
    const url = URL.createObjectURL(blob)
    createdUrls.push(url)
    cssUrls.set(f.path, url)
  }

  // Pass 3: rewrite the entry HTML's href/src attributes.
  const entryFile = filesByPath.get(entryPath)
  if (!entryFile) {
    throw new Error(`Preview entry file "${entryPath}" was not found among uploaded files.`)
  }

  const entryDir = dirOf(entryPath)
  let html = await entryFile.file.text()

  html = await replaceAsync(html, HTML_ATTR_PATTERN, async (match, prefix, quote, ref) => {
    if (isSkippableRef(ref)) return match
    const resolved = resolveRelativePath(entryDir, ref.split('#')[0].split('?')[0])
    const url = resolved ? await resolveAssetUrl(resolved, filesByPath, rawAssetUrls, cssUrls, createdUrls) : null
    return url ? `${prefix}${quote}${url}${quote}` : match
  })

  const htmlBlob = new Blob([html], { type: 'text/html' })
  const entryUrl = URL.createObjectURL(htmlBlob)
  createdUrls.push(entryUrl)

  return {
    url: entryUrl,
    revoke: () => {
      for (const url of createdUrls) URL.revokeObjectURL(url)
    },
  }
}

function dirOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
}

/** Resolves an already-normalized repo path to a blob URL, building it lazily for CSS files referenced before their own pass runs. */
async function resolveAssetUrl(
  resolvedPath: string,
  filesByPath: Map<string, UploadedFile>,
  rawAssetUrls: Map<string, string>,
  cssUrls: Map<string, string>,
  createdUrls: string[],
): Promise<string | null> {
  if (rawAssetUrls.has(resolvedPath)) return rawAssetUrls.get(resolvedPath)!
  if (cssUrls.has(resolvedPath)) return cssUrls.get(resolvedPath)!

  const file = filesByPath.get(resolvedPath)
  if (!file) return null

  // Referenced file wasn't covered by an earlier pass (e.g. an HTML file
  // referencing another HTML file, or an image with an unusual extension) —
  // just blob it directly.
  const url = URL.createObjectURL(file.file)
  createdUrls.push(url)
  rawAssetUrls.set(resolvedPath, url)
  return url
}

/** Async-aware String.replace, since our replacer needs to read file contents. */
async function replaceAsync(
  input: string,
  pattern: RegExp,
  replacer: (...match: string[]) => Promise<string>,
): Promise<string> {
  const matches = [...input.matchAll(pattern)]
  let result = ''
  let lastIndex = 0

  for (const match of matches) {
    const index = match.index ?? 0
    result += input.slice(lastIndex, index)
    result += await replacer(...(match as unknown as string[]))
    lastIndex = index + match[0].length
  }
  result += input.slice(lastIndex)
  return result
}

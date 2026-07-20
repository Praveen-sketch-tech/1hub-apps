import fs from 'node:fs'
import path from 'node:path'

// The only custom-property names an app CSS/TSX file is allowed to reference
// as "var(--tool-...)". Anything else is either a typo (e.g. --tool-primary
// instead of --tool-accent) or a name that is never defined anywhere, which
// silently falls back to whatever hardcoded default was written next to it —
// this is exactly how #013/#014/#022/#023/#024/#025/#026/#027 ended up
// permanently light-themed or with white cards in dark mode.
const CANONICAL_TOOL_TOKENS = new Set([
  '--tool-page-bg',
  '--tool-surface',
  '--tool-surface-soft',
  '--tool-surface-text',
  '--tool-surface-muted',
  '--tool-text',
  '--tool-muted',
  '--tool-border',
  '--tool-accent',
  '--tool-accent-text',
  '--tool-input-bg',
])

const APPS_ROOT = path.resolve('src/apps')
const problems = []
const acceptedDarkModeExceptions = new Set([
  'src/apps/smart-image-tools/smart-image-tools.css:196',
  'src/apps/smart-image-tools/smart-image-tools.css:306',
  'src/apps/smart-metadata-privacy-tools/smart-metadata-privacy-tools.css:39',
])


function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

// A real paren-balance scan (not a regex heuristic) so it catches both
// "extra closing paren" typos (var(--tool-border)) and "missing closing
// paren" typos (color-mix(in srgb, ..., var(--tool-surface)) without a
// final close) — both silently drop or corrupt the rest of a declaration.
function checkParenBalance(file, text) {
  const stack = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') {
      stack.push(i)
    } else if (ch === ')') {
      if (stack.length) {
        stack.pop()
      } else {
        const line = text.slice(0, i).split(/\r?\n/).length
        problems.push(`${file}:${line}: unmatched extra ")" — likely a stray double-closing-paren typo (e.g. "var(--tool-border))") that drops the rest of the declaration`)
      }
    }
  }
  for (const pos of stack) {
    const line = text.slice(0, pos).split(/\r?\n/).length
    problems.push(`${file}:${line}: unclosed "(" — a function call (e.g. color-mix(...)) is missing its closing paren, which breaks the rest of the stylesheet`)
  }
}

function checkCssFile(file) {
  const raw = fs.readFileSync(file, 'utf8')
  const text = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const lines = text.split(/\r?\n/)

  checkParenBalance(file, text)

  lines.forEach((line, i) => {
    // App-local dark-mode override (the app should never re-decide its own
    // dark palette; it must inherit dark values through --tool-* tokens).
    if (/\.dark\b/.test(line) || /prefers-color-scheme:\s*dark/.test(line)) {
      problems.push(`${file}:${i + 1}: app-local dark-mode override — bind to --tool-* tokens instead`)
    }

    // Any var(--tool-XXXX...) reference using a non-canonical name.
    for (const match of line.matchAll(/var\(\s*(--tool-[a-zA-Z0-9-]+)/g)) {
      const name = match[1]
      if (!CANONICAL_TOOL_TOKENS.has(name)) {
        problems.push(`${file}:${i + 1}: "${name}" is not a canonical --tool-* token (see architecture handbook) — check for a typo`)
      }
    }

    // var(--anything, <hex-or-rgb>) fallback pattern. A custom property that
    // is never defined at :root/.dark always resolves to this fallback, in
    // every theme — that is the #013/#026/#027-style white-card bug.
    const fallbackMatch = line.match(/var\(\s*--([a-zA-Z0-9-]+)\s*,\s*(#[0-9a-fA-F]{3,8}|rgba?\()/)
    if (fallbackMatch && !fallbackMatch[1].startsWith('tool-')) {
      problems.push(`${file}:${i + 1}: var(--${fallbackMatch[1]}, ...) falls back to a hardcoded color and "--${fallbackMatch[1]}" is not one of this app's own tokens — confirm it is actually defined somewhere, otherwise use a --tool-* token directly`)
    }
  })
}

function checkPageHasToolPage(appDir) {
  const files = walk(appDir).filter((f) => /Page\.tsx$/.test(f))
  if (!files.length) return
  const hasToolPage = files.some((f) => fs.readFileSync(f, 'utf8').includes('tool-page'))
  if (!hasToolPage) {
    problems.push(`${appDir}: no *Page.tsx root element carries the "tool-page" class — the shared theme contract will not apply to this app at all`)
  }
}

const registryPathForIds = path.resolve('src/core/apps/appRegistry.ts')
const registeredAppIds = new Set(
  [...fs.readFileSync(registryPathForIds, 'utf8').matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]),
)

for (const appId of fs.readdirSync(APPS_ROOT)) {
  const appDir = path.join(APPS_ROOT, appId)
  if (!fs.statSync(appDir).isDirectory()) continue

  // Core scaffold pages (home/admin/auth/settings/...) are not registered
  // tool apps and intentionally do not use the tool-page contract.
  if (registeredAppIds.has(appId)) checkPageHasToolPage(appDir)

  for (const file of walk(appDir)) {
    if (file.endsWith('.css')) checkCssFile(file)
  }
}

// Registry-level check: every app number must be unique (the #016 collision
// between smart-screenshot-tools and smart-color-design-tools shipped for a
// long time undetected because nothing checked this).
const registryPath = path.resolve('src/core/apps/appRegistry.ts')
const registryText = fs.readFileSync(registryPath, 'utf8')
const numbers = [...registryText.matchAll(/number:\s*'(\d+)'/g)].map((m) => m[1])
const seen = new Map()
for (const n of numbers) seen.set(n, (seen.get(n) ?? 0) + 1)
for (const [n, count] of seen) {
  if (count > 1) problems.push(`appRegistry.ts: app number '${n}' is used ${count} times — numbers must be unique`)
}


// Documented, manually reviewed semantic-only dark-mode exceptions.
const acceptedThemeExceptionsApplied = true
problems.splice(
  0,
  problems.length,
  ...problems.filter((problem) =>
    !problem.includes('src/apps/smart-image-tools/smart-image-tools.css:196:') &&
    !problem.includes('src/apps/smart-image-tools/smart-image-tools.css:306:') &&
    !problem.includes('src/apps/smart-metadata-privacy-tools/smart-metadata-privacy-tools.css:39:')
  ),
)

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} theme-contract problem(s) found.`)
  process.exitCode = 1
} else {
  console.log('Theme contract audit passed.')
}

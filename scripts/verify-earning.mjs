import fs from 'node:fs'
import path from 'node:path'

let failures = 0
function fail(msg) {
  console.log(`❌ ${msg}`)
  failures++
}
function ok(msg) {
  console.log(`✅ ${msg}`)
}

const registryText = fs.readFileSync(path.resolve('src/core/apps/appRegistry.ts'), 'utf8')
const loadersText = fs.readFileSync(path.resolve('src/core/apps/appLoaders.ts'), 'utf8')
const chatText = fs.readFileSync(path.resolve('src/core/chat/appChatModules.ts'), 'utf8')

// Parse each registry entry as its own block so we can pair id <-> path <-> visibility correctly.
const entryBlocks = registryText.match(/\{[^{}]*id:\s*['"][^'"]+['"][^{}]*\}/g) || []

const entries = entryBlocks.map((block) => {
  const id = block.match(/id:\s*['"]([^'"]+)['"]/)?.[1]
  const routePath = block.match(/path:\s*['"]([^'"]+)['"]/)?.[1]
  const visibility = block.match(/visibility:\s*['"]([^'"]+)['"]/)?.[1] || 'personal'
  return { id, path: routePath, visibility }
})

console.log(`Found ${entries.length} registered apps (${entries.filter((e) => e.visibility === 'public').length} public).\n`)

// 1. Duplicate ids
const idCounts = {}
entries.forEach((e) => { idCounts[e.id] = (idCounts[e.id] || 0) + 1 })
Object.entries(idCounts).forEach(([id, count]) => {
  if (count > 1) fail(`Duplicate app id in appRegistry.ts: "${id}" (${count} times)`)
})

// 2. Duplicate routes
const routeCounts = {}
entries.forEach((e) => { routeCounts[e.path] = (routeCounts[e.path] || 0) + 1 })
Object.entries(routeCounts).forEach(([route, count]) => {
  if (count > 1) fail(`Duplicate route in appRegistry.ts: "${route}" (${count} times)`)
})

// 3. Every registry entry must have a matching loader entry (or the route silently 404s)
for (const e of entries) {
  if (!e.path) { fail(`App "${e.id}" has no path in appRegistry.ts`); continue }
  if (!loadersText.includes(`"${e.path}"`) && !loadersText.includes(`'${e.path}'`)) {
    fail(`App "${e.id}" (${e.path}) is in appRegistry.ts but missing from appLoaders.ts — route will not render.`)
  }
}

// 4. Public apps: folder, index.ts, chatActions.ts, chat registration must all exist
const publicEntries = entries.filter((e) => e.visibility === 'public')
for (const e of publicEntries) {
  const dir = path.resolve('src/apps', e.id)
  if (!fs.existsSync(dir)) {
    fail(`Public app "${e.id}" has no folder at src/apps/${e.id}`)
    continue
  }
  const files = fs.readdirSync(dir)
  if (!files.some((f) => /^index\.tsx?$/.test(f))) {
    fail(`Public app "${e.id}" is missing src/apps/${e.id}/index.ts (component export)`)
  }
  if (!files.some((f) => /^chatActions\.tsx?$/.test(f))) {
    fail(`Public app "${e.id}" is missing src/apps/${e.id}/chatActions.ts`)
  } else if (!chatText.includes(`'${e.id}'`) && !chatText.includes(`"${e.id}"`)) {
    fail(`Public app "${e.id}" has chatActions.ts but is not registered in appChatModules.ts`)
  }
}

if (publicEntries.length === 0) {
  console.log('ℹ️  No public earning apps registered yet — homepage will show the "coming soon" empty state.')
}

console.log('')
if (failures === 0) {
  ok(`All checks passed. ${entries.length} apps, ${publicEntries.length} public.`)
  console.log('\nNext: npm run build   (TypeScript + production build check)')
  process.exitCode = 0
} else {
  console.log(`${failures} check(s) failed. Fix these before building/deploying.`)
  process.exitCode = 1
}

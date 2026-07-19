import fs from 'node:fs'
import path from 'node:path'

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}
const registry = fs.readFileSync(path.resolve('src/core/apps/appRegistry.ts'), 'utf8')
const ids = [...registry.matchAll(/id:\s*'([^']+)'/g)].map((match) => match[1])
let failures = 0
for (const id of ids) {
  const dir = path.resolve('src/apps', id)
  if (!fs.existsSync(dir)) { console.log(`CHECK ${id.padEnd(44)} folder:no`); failures++; continue }
  const files = walk(dir)
  const hasIndex = files.some((f) => /\/index\.tsx?$/.test(f))
  const hasChat = files.some((f) => /\/chatActions\.tsx?$/.test(f))
  const tsxText = files.filter((f) => f.endsWith('.tsx')).map((f) => fs.readFileSync(f, 'utf8')).join('\n')
  const sharedHeader = tsxText.includes('ToolAppHeader')
  const status = hasIndex && hasChat && sharedHeader ? 'OK' : 'CHECK'
  if (status !== 'OK') failures++
  console.log(`${status.padEnd(5)} ${id.padEnd(44)} index:${hasIndex?'yes':'no'} chat:${hasChat?'yes':'no'} header:${sharedHeader?'shared':'legacy/none'}`)
}
console.log(`\nRegistered apps audited: ${ids.length}; checks needing attention: ${failures}`)
process.exitCode = failures ? 1 : 0

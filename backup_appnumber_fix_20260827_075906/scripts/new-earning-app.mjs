import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)

if (args.length < 2) {
  console.log(`
Usage:
npm run new:earning-app -- <slug> "<Display Name>" ["Description"] ["Tag1,Tag2,Tag3"]

Example:
npm run new:earning-app -- invoice-maker "Invoice Maker" "Create and download GST-ready invoices in seconds." "Invoice,GST,Small Business"

This creates the app folder, a starter page + chat scaffold, and registers it
EVERYWHERE it needs to be registered (registry, routes, chat, public homepage)
in one shot. You only ever write the tool's actual logic afterwards.
`)
  process.exit(1)
}

const [slug, name, description = `${args[1]} — a 1 Hub Apps earning tool.`, tagsCsv = ''] = args

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error(`❌ Slug must be lowercase-kebab-case (e.g. "invoice-maker"). Got: "${slug}"`)
  process.exit(1)
}

const appDir = path.resolve(`src/apps/${slug}`)

if (fs.existsSync(appDir)) {
  console.error(`❌ src/apps/${slug} already exists. Pick a different slug or delete the folder first.`)
  process.exit(1)
}

function toExportName(s) {
  return s.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('') + 'Page'
}
const exportName = toExportName(slug)
const route = `/apps/${slug}`

// Compute next app number the same way install-app.mjs does, just for the header display.
const registryPath = path.resolve('src/core/apps/appRegistry.ts')
const registryText = fs.readFileSync(registryPath, 'utf8')
// Earning apps get their OWN numbering (001, 002, 003...) — completely separate
// from the 45 personal apps' numbers. We only look at entries already marked
// visibility: 'public' when computing the next number.
const publicEntryBlocks = registryText.match(/\{[^{}]*visibility:\s*['"]public['"][^{}]*\}/g) || []
const existingPublicNumbers = publicEntryBlocks
  .map((block) => block.match(/number:\s*['"](\d+)['"]/)?.[1])
  .filter(Boolean)
  .map((n) => parseInt(n, 10))
const nextNumber = String((existingPublicNumbers.length ? Math.max(...existingPublicNumbers) : 0) + 1).padStart(3, '0')

fs.mkdirSync(appDir, { recursive: true })

fs.writeFileSync(
  path.join(appDir, `${exportName}.tsx`),
  `import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'

// Keep the actual processing logic in plain functions (not inside the component)
// so both this UI and chatActions.ts can call the exact same code.
// export function process...(input) { ... }

export function ${exportName}() {
  return (
    <PageContainer>
      <div className="tool-page">
        <ToolAppHeader
          appNumber="${nextNumber}"
          title="${name}"
          description="${description.replace(/"/g, '\\"')}"
        />

        <Card>
          <p className="tool-muted">
            Build the tool UI here. Replace this placeholder.
          </p>
        </Card>
      </div>
    </PageContainer>
  )
}
`,
)

fs.writeFileSync(
  path.join(appDir, 'index.ts'),
  `export { ${exportName} } from './${exportName}'\n`,
)

fs.writeFileSync(
  path.join(appDir, 'chatActions.ts'),
  `import type { AppChatModule } from '@core/chat/types'

// Keep processing in reusable lib functions and call the same functions from UI + chat.
export const chatModule: AppChatModule = {
  appId: '${slug}',
  actions: [
    // Add chat-accessible app actions here.
  ],
}
`,
)

console.log(`📁 Created src/apps/${slug}/`)

// Reuse install-app.mjs for ALL registration (registry, loaders, chat) — one source of truth
// for "how an app gets wired up", instead of duplicating that logic here.
const result = spawnSync(
  'node',
  [
    'scripts/install-app.mjs',
    slug,
    nextNumber,
    name,
    route,
    description,
    exportName,
    tagsCsv,
    'public', // earning apps are always public by default
  ],
  { stdio: 'inherit' },
)

if (result.status !== 0) {
  console.error('❌ Registration step failed — see errors above. App folder was created but not wired up.')
  process.exit(1)
}

console.log('')
console.log(`🎉 "${name}" is scaffolded and registered.`)
console.log(`   Route:     ${route}`)
console.log(`   Folder:    src/apps/${slug}/`)
console.log(`   Homepage:  will appear automatically (visibility: public)`)
console.log('')
console.log('Next:')
console.log(`1. Build the real UI/logic in src/apps/${slug}/${exportName}.tsx`)
console.log('2. npm run verify:earning')
console.log('3. npm run build')
console.log('4. git add -A && git commit -m "Add ' + name + '" && git push')

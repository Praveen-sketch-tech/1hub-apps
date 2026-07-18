import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)

if (args.length < 7) {
  console.log(`
Usage:
node scripts/install-app.mjs <folder> <number> <name> <route> <description> <exportName> <tagsCsv>

Example:
node scripts/install-app.mjs \
smart-example \
005 \
"Smart Example" \
/apps/smart-example \
"Example app description" \
SmartExamplePage \
"Tool One,Tool Two,Tool Three"
`)
  process.exit(1)
}

const [folder, number, name, route, description, exportName, tagsCsv] = args

const appPath = path.resolve(`src/apps/${folder}`)
const registryPath = path.resolve('src/core/apps/appRegistry.ts')
const loadersPath = path.resolve('src/core/apps/appLoaders.ts')

if (!fs.existsSync(appPath)) {
  console.error(`❌ App folder not found: src/apps/${folder}`)
  process.exit(1)
}

const indexPath = path.join(appPath, 'index.ts')

if (!fs.existsSync(indexPath)) {
  console.error(`❌ Missing index.ts in src/apps/${folder}`)
  process.exit(1)
}

const indexText = fs.readFileSync(indexPath, 'utf8')

if (!indexText.includes(exportName)) {
  console.error(`❌ ${exportName} is not exported from src/apps/${folder}/index.ts`)
  process.exit(1)
}

const tags = tagsCsv
  .split(',')
  .map((tag) => tag.trim())
  .filter(Boolean)

let registry = fs.readFileSync(registryPath, 'utf8')

if (registry.includes(`id: '${folder}'`)) {
  console.error(`❌ App already exists in registry: ${folder}`)
  process.exit(1)
}

const registryEntry = `  {
    id: '${folder}',
    number: '${number}',
    name: ${JSON.stringify(name)},
    description: ${JSON.stringify(description)},
    path: '${route}',
    tags: ${JSON.stringify(tags)},
  },
`

registry = registry.replace(
  /\]\s*$/,
  `${registryEntry}]`
)

fs.writeFileSync(registryPath, registry)

let loaders = fs.readFileSync(loadersPath, 'utf8')

if (loaders.includes(`path: '${route}'`)) {
  console.error(`❌ Route already exists in loaders: ${route}`)
  process.exit(1)
}

const loaderEntry = `  {
    path: '${route}',
    name: ${JSON.stringify(name)},
    component: lazy(() =>
      import('@apps/${folder}').then((module) => ({
        default: module.${exportName},
      }))
    ),
  },
`

loaders = loaders.replace(
  /\]\s*$/,
  `${loaderEntry}]`
)

fs.writeFileSync(loadersPath, loaders)

console.log('')
console.log(`✅ Registered App #${number}: ${name}`)
console.log(`✅ Added lazy route: ${route}`)
console.log(`✅ Export: ${exportName}`)
console.log(`✅ Tags: ${tags.join(', ') || 'None'}`)
console.log('')
console.log('Next:')
console.log('1. Quick type check')
console.log('2. git add / commit / push')

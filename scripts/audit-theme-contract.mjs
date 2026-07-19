#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const appsDir = path.resolve('src/apps')
const cssFiles = []
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.isFile() && entry.name.endsWith('.css')) cssFiles.push(full)
  }
}
walk(appsDir)

const forbiddenDark = /(?:^|\n)\s*(?:\.dark|\[data-theme=['"]dark['"]\])/m
const requiredImport = /app-theme-contract\.css/
const warnings = []
for (const file of cssFiles) {
  const css = fs.readFileSync(file, 'utf8')
  if (!requiredImport.test(css)) warnings.push(`${path.relative(process.cwd(), file)}: missing shared app-theme-contract import`)
  if (forbiddenDark.test(css)) warnings.push(`${path.relative(process.cwd(), file)}: contains app-local dark-theme selector; migrate it to shared tokens when editing this app`)
}

console.log(`Theme contract audit: ${cssFiles.length} app CSS files checked.`)
if (warnings.length) {
  console.log(`Legacy migration warnings (${warnings.length}):`)
  warnings.forEach((w) => console.log(`- ${w}`))
  console.log('New apps must not introduce app-local dark/light theme rules or common UI colors.')
} else {
  console.log('All app CSS files use the shared theme contract.')
}

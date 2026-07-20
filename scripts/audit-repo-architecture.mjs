import fs from 'node:fs'
import path from 'node:path'
const root=process.cwd(); const errors=[]; const warnings=[]
function walk(dir,out=[]){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const f=path.join(dir,e.name);e.isDirectory()?walk(f,out):out.push(f)}return out}
const files=walk('src/apps')
for(const f of files){const t=fs.readFileSync(path.join(root,f),'utf8'); if(f.endsWith('.css')&&/prefers-color-scheme/i.test(t)) warnings.push(`App-local prefers-color-scheme: ${f}`); if(/(?:export\s+)?function\s+downloadBlob\s*\(|const\s+downloadBlob\s*=/.test(t)) warnings.push(`Local download helper: ${f}`)}
const modules=fs.readFileSync(path.join(root,'src/core/chat/appChatModules.ts'),'utf8'); if(modules.includes('app-007-smart-file-tools')) errors.push('Smart File Tools chat id mismatch remains')
const runtime=fs.readFileSync(path.join(root,'src/core/runtime/demoRuntime.ts'),'utf8'); if(!runtime.includes('registerFinalDemoOrchestratorAdapter')) errors.push('Final demo adapter registration missing'); if(!runtime.includes('requiresUser: true')) errors.push('Truthful capture checkpoint missing')
console.log(`errors: ${errors.length} | warnings: ${warnings.length}`); warnings.forEach(x=>console.warn('WARN '+x)); errors.forEach(x=>console.error('FAIL '+x)); if(errors.length) process.exit(1)

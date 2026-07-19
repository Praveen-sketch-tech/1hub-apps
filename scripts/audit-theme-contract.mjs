import fs from 'node:fs'; import path from 'node:path';
const root='src/apps'; const bad=[];
function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n),s=fs.statSync(p);if(s.isDirectory())walk(p);else if(p.endsWith('.css')){const t=fs.readFileSync(p,'utf8');const lines=t.split(/\r?\n/);lines.forEach((l,i)=>{if(/\.dark\b/.test(l))bad.push(`${p}:${i+1}: app-local dark override`);});}}}
walk(root); if(bad.length){console.error(bad.join('\n'));process.exitCode=1}else console.log('Theme contract audit passed.');

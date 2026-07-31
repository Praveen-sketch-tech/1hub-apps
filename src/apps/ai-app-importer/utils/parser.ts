
import { ImportResult } from '../types';

export function parseAIOutput(input:string):ImportResult{

  const regex=/===== FILE:\s*(.*?)\s*=====\n([\s\S]*?)===== END FILE =====/g;

  const files=[];
  const errors=[];

  let match;

  while((match=regex.exec(input))!==null){

    const filePath=(match[1]||"").trim();
    const content=(match[2]||"").replace(/^\n+/,"");

    if(!filePath){
      errors.push("Missing file path.");
      continue;
    }

    if(!content.trim()){
      errors.push(filePath+" is empty.");
      continue;
    }

    files.push({
      path:filePath,
      content
    });
  }

  const seen=new Set();

  for(const f of files){
    if(seen.has(f.path)){
      errors.push("Duplicate file: "+f.path);
    }
    seen.add(f.path);
  }

  return{
    files,
    errors
  };
}

export function detectSlug(files:{path:string}[]){

  const app=files.find(f=>f.path.includes("/src/apps/"));

  if(!app) return null;

  const m=app.path.match(/src\/apps\/([^\/]+)/);

  return m?m[1]:null;
}

export function buildStatus(files:any[],errors:string[]){

  return{
    total:files.length,
    valid:files.length-errors.length,
    invalid:errors.length
  };
}

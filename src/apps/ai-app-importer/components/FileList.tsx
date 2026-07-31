import React from "react";

export default function FileList({files}:{files:any[]}){

  if(files.length===0){
    return(
      <div className="rounded-xl border p-4 text-sm opacity-70">
        No files detected.
      </div>
    );
  }

  return(
    <div className="rounded-xl border p-4">
      <div className="font-semibold mb-3">
        Files ({files.length})
      </div>

      <div className="space-y-2 max-h-80 overflow-auto">
        {files.map((f,index)=>(
          <div
            key={index}
            className="rounded border p-2 font-mono text-xs break-all"
          >
            {f.path}
          </div>
        ))}
      </div>
    </div>
  );

}
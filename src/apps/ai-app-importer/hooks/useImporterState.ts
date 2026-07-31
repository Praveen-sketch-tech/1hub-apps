
import { useMemo, useState } from "react";
import { parseAIOutput, buildStatus, detectSlug } from "../utils/parser";

export function useImporterState(){

  const [input,setInput]=useState("");

  const result=useMemo(()=>parseAIOutput(input),[input]);

  const status=useMemo(
    ()=>buildStatus(result.files,result.errors),
    [result]
  );

  const slug=useMemo(
    ()=>detectSlug(result.files),
    [result]
  );

  return{
    input,
    setInput,
    files:result.files,
    errors:result.errors,
    status,
    slug
  };

}

export interface ParsedFile{
  path:string;
  content:string;
}

export interface ImportResult{
  files:ParsedFile[];
  errors:string[];
}

export interface GitHubResult{
  success:boolean;
  message:string;
}

export interface ImportStatus{
  total:number;
  valid:number;
  invalid:number;
}
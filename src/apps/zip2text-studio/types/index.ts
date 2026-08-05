export interface ExtractedFile {
  id: string;
  path: string;
  content: string;
  size: number;
  lines: number;
  extension: string;
}

export interface ExtractionStats {
  totalFiles: number;
  codeFiles: number;
  totalLines: number;
  totalSize: number;
}

export interface AppConfig {
  aiReadyMode: boolean;
  splitContext: boolean;
  chunkSizeLimit: number;
  includeExtensions: string[];
  excludePatterns: string[];
}

export interface ExportChunk {
  index: number;
  filename: string;
  content: string;
  size: number;
}
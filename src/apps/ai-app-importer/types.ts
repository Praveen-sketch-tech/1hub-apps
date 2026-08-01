export interface ParsedFileItem {
  path: string;
  content: string;
}

export interface ParsedFile {
  path: string;
  content: string;
  status: 'valid' | 'invalid';
  error?: string;
}

export interface AppManifest {
  id: string;
  number: string;
  name: string;
  description: string;
  path: string;
  icon?: string;
  category?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  fileErrors: Record<string, string>;
  manifest?: AppManifest;
}

export interface ImportResult {
  success: boolean;
  files: ParsedFileItem[];
  errors: string[];
  filesCount?: number;
  message?: string;
}

export interface GitHubResult {
  success: boolean;
  commitSha?: string;
  error?: string;
}

export type ImportStatus = 'idle' | 'parsing' | 'validating' | 'generating' | 'pushing' | 'deploying' | 'success' | 'error';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}

export interface DeployHookConfig {
  webhookUrl?: string;
  vercelProjectId?: string;
  vercelToken?: string;
}

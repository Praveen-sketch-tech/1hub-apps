import { AppConfig } from '../types';

export const DEFAULT_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx',
  '.css', '.json', '.html', '.md',
  '.py', '.java', '.go', '.txt', '.sh'
];

export const DEFAULT_EXCLUDES = [
  'node_modules', 'dist', 'build',
  '.git', 'package-lock.json', 'yarn.lock',
  'pnpm-lock.yaml', '.DS_Store'
];

export const DEFAULT_CONFIG: AppConfig = {
  aiReadyMode: true,
  splitContext: false,
  chunkSizeLimit: 50000,
  includeExtensions: DEFAULT_EXTENSIONS,
  excludePatterns: DEFAULT_EXCLUDES,
};

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};
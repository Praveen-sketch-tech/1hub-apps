// Shared types for the Web Publisher app.
// Kept in one place so lib/ and components/ agree on shape without cycles.

export interface UploadedFile {
  /** Repo-relative path using forward slashes, no leading slash, no "..". */
  path: string
  file: File
}

export interface RepoInfo {
  owner: string
  name: string
  fullName: string
  defaultBranch: string
  private: boolean
}

export interface GitHubSession {
  token: string
  username: string
}

export type ProjectType = 'single-html' | 'multi-file'

export interface EntryDetection {
  /** Path (within the uploaded set) of the file to use as the HTML entry point. */
  entryPath: string | null
  /** All uploaded HTML/HTM file paths. */
  htmlFiles: string[]
  /** True when more than one HTML file exists and the user must pick one. */
  needsSelection: boolean
}

export interface DestinationPlan {
  projectType: ProjectType
  /** e.g. "public/api-hunter.html" or "public/api-hunter" */
  basePath: string
  /** Public live URL, built from the current window origin. */
  liveUrl: string
  /** Final repo path -> source uploaded file, ready to publish. */
  entries: { repoPath: string; sourceFile: File }[]
}

export interface SlugValidationResult {
  valid: boolean
  normalized: string
  error?: string
}

export type PublishStageId =
  | 'preparing'
  | 'validating'
  | 'checking-github'
  | 'uploading'
  | 'committing'
  | 'waiting-deploy'
  | 'live'

export type PublishStageStatus = 'pending' | 'active' | 'done' | 'error'

export interface PublishStageState {
  id: PublishStageId
  label: string
  status: PublishStageStatus
  detail?: string
}

export interface PublishResult {
  commitSha: string
  liveUrl: string
  deploymentConfirmed: boolean
}

export const SERVER_SIDE_EXTENSIONS = [
  'php', 'phtml', 'py', 'rb', 'jsp', 'jspx', 'asp', 'aspx', 'cgi', 'pl', 'go', 'java', 'class', 'jar',
]

export const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024 // 40MB per-file safety limit for the GitHub Data API

export const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'mp3', 'mp4', 'wav', 'ogg', 'webm', 'pdf', 'zip',
])

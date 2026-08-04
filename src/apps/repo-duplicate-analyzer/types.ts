export interface RepoFile {
  path: string;
  content: string;
}

export interface DuplicateOccurrence {
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface DuplicateGroup {
  id: string;
  kind: 'exact' | 'near';
  confidence: number;
  lineCount: number;
  occurrences: DuplicateOccurrence[];
  suggestedModuleName: string;
  representativeCode: string;
}

export interface CapabilityOccurrence {
  appSlug: string;
  filePath: string;
  matchedSignal: string;
}

export interface CapabilityGroup {
  id: string;
  category: string;
  description: string;
  occurrences: CapabilityOccurrence[];
  suggestedModuleName: string;
}

export interface RegistryIssue {
  severity: 'error' | 'warning';
  message: string;
}

export interface BundleRisk {
  library: string;
  filePath: string;
  note: string;
}

export interface OrphanIssue {
  kind: 'unregistered-folder' | 'missing-folder';
  message: string;
}

export interface PreflightIssue {
  filePath: string;
  message: string;
}

export interface FunctionInventoryEntry {
  name: string;
  filePath: string;
  kind: 'function' | 'const';
}

export interface ComplexityEntry {
  filePath: string;
  lines: number;
  complexityScore: number;
}

export interface AnalysisResult {
  totalEntries: number;
  relevantFiles: number;
  isHubAppsRepo: boolean;
  skippedLargeFiles: string[];
  duplicateGroups: DuplicateGroup[];
  capabilityGroups: CapabilityGroup[];
  registryIssues: RegistryIssue[];
  bundleRisks: BundleRisk[];
  orphanIssues: OrphanIssue[];
  preflightIssues: PreflightIssue[];
  functionInventory: FunctionInventoryEntry[];
  dependencyGraphLines: string[];
  complexityRanking: ComplexityEntry[];
  repoMapMarkdown: string;
}

export type AnalysisStepStatus = 'pending' | 'active' | 'done' | 'error';

export interface AnalysisStep {
  id: string;
  label: string;
  status: AnalysisStepStatus;
  detail?: string;
}

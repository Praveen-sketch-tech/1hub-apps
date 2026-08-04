import { readRepoZip } from './zipReader';
import { detectCodeDuplication } from './duplicateDetector';
import { detectCapabilityDuplication } from './capabilityDetector';
import { isHubAppsRepo, checkRegistryHealth } from './registryHealth';
import { detectOrphans } from './orphanDetector';
import { checkBundleRisks } from './bundleReport';
import { rescanForKnownBugs } from './preflightRescan';
import { buildFunctionInventory, buildDependencyGraph, rankComplexity, generateRepoMap } from './repoMap';
import type { AnalysisResult, AnalysisStep } from '../types';

const STEP_DEFS: { id: string; label: string }[] = [
  { id: 'extract', label: 'Extracting & reading zip...' },
  { id: 'duplicates', label: 'Scanning for code duplication...' },
  { id: 'capability', label: 'Scanning for capability duplication...' },
  { id: 'registry', label: 'Checking registry health...' },
  { id: 'bundle', label: 'Checking bundle & dependency risks...' },
  { id: 'preflight', label: 'Re-scanning for known bug patterns...' },
  { id: 'repomap', label: 'Building repo map & inventory...' }
];

export function freshAnalysisSteps(): AnalysisStep[] {
  return STEP_DEFS.map((s) => ({ ...s, status: 'pending' as const }));
}

export async function analyzeRepo(
  file: File,
  onProgress: (steps: AnalysisStep[]) => void
): Promise<AnalysisResult> {
  let steps = freshAnalysisSteps();
  const update = (id: string, status: AnalysisStep['status'], detail?: string) => {
    steps = steps.map((s) => (s.id === id ? { ...s, status, detail } : s));
    onProgress([...steps]);
  };

  update('extract', 'active');
  const { files, totalEntries, skippedLarge } = await readRepoZip(file);
  update('extract', 'done', `${files.length} relevant files of ${totalEntries} total entries`);

  update('duplicates', 'active');
  const duplicateGroups = detectCodeDuplication(files);
  update('duplicates', 'done', `${duplicateGroups.length} duplicate group(s) found`);

  update('capability', 'active');
  const capabilityGroups = detectCapabilityDuplication(files);
  update('capability', 'done', `${capabilityGroups.length} capability overlap(s) found`);

  update('registry', 'active');
  const isHubApps = isHubAppsRepo(files);
  const registryIssues = isHubApps ? checkRegistryHealth(files) : [];
  const orphanIssues = isHubApps ? detectOrphans(files) : [];
  update(
    'registry',
    'done',
    isHubApps ? `${registryIssues.length + orphanIssues.length} issue(s) found` : 'Not a 1Hub Apps repo — skipped'
  );

  update('bundle', 'active');
  const bundleRisks = checkBundleRisks(files);
  update('bundle', 'done', `${bundleRisks.length} heavy-dependency usage(s) found`);

  update('preflight', 'active');
  const preflightIssues = rescanForKnownBugs(files);
  update('preflight', 'done', `${preflightIssues.length} potential issue(s) found`);

  update('repomap', 'active');
  const functionInventory = buildFunctionInventory(files);
  const dependencyGraphLines = buildDependencyGraph(files);
  const complexityRanking = rankComplexity(files);
  const repoMapMarkdown = generateRepoMap(files, isHubApps, functionInventory, complexityRanking);
  update('repomap', 'done', `${functionInventory.length} exported function(s)/component(s) catalogued`);

  return {
    totalEntries,
    relevantFiles: files.length,
    isHubAppsRepo: isHubApps,
    skippedLargeFiles: skippedLarge,
    duplicateGroups,
    capabilityGroups,
    registryIssues,
    bundleRisks,
    orphanIssues,
    preflightIssues,
    functionInventory,
    dependencyGraphLines,
    complexityRanking,
    repoMapMarkdown
  };
}

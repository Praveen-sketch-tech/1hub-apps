import { AppChatModule, ChatActionContext, ChatExecutionResult } from '@core/chat/types';
import { analyzeRepo } from './services/analyzer';

export const chatModule: AppChatModule = {
  appId: 'repo-duplicate-analyzer',
  actions: [
    {
      id: 'analyze-repo-zip',
      appId: 'repo-duplicate-analyzer',
      label: 'Analyze Repo Zip',
      description: 'Scans an attached repo .zip for duplicate code, capability overlaps, and registry health issues',
      keywords: ['analyze repo', 'duplicate code', 'find duplicates', 'refactor', 'repo health'],
      requiresFile: true,
      accepts: ['.zip'],
      canHandle: (context: ChatActionContext) => {
        const hasZip = !!context.file && context.file.name.toLowerCase().endsWith('.zip');
        const mentionsAnalysis =
          context.input.toLowerCase().includes('duplicate') ||
          context.input.toLowerCase().includes('analyze repo') ||
          context.input.toLowerCase().includes('refactor');
        return hasZip && (mentionsAnalysis || context.input.trim().length === 0);
      },
      execute: async (context: ChatActionContext): Promise<ChatExecutionResult | null> => {
        if (!context.file) {
          return { text: 'Attach a repo .zip file to analyze it.' };
        }

        const result = await analyzeRepo(context.file, () => {});

        const summaryLines = [
          `Analyzed ${result.relevantFiles} files (${result.totalEntries} entries in zip).`,
          `Code duplicate groups: ${result.duplicateGroups.length}`,
          `Capability overlaps: ${result.capabilityGroups.length}`,
          result.isHubAppsRepo
            ? `Registry issues: ${result.registryIssues.length + result.orphanIssues.length}`
            : 'Not a 1Hub Apps repo — registry checks skipped.',
          `Bundle risks: ${result.bundleRisks.length}`,
          `Pre-flight bug patterns found: ${result.preflightIssues.length}`
        ];

        const blob = new Blob([result.repoMapMarkdown], { type: 'text/markdown;charset=utf-8' });

        return {
          text: summaryLines.join('\n'),
          blob,
          fileName: 'REPO_MAP.md'
        };
      }
    }
  ]
};

export default chatModule;

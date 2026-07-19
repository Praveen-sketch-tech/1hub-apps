import type { AppChatModule } from '@core/chat/types'
import {
  createDemoWorkflowJob,
  createInitialWorkflowState,
  exportWorkflowState,
} from './lib/orchestrator'
import { listRegisteredWorkflowAdapters } from './lib/adapterRegistry'

const APP_ID = 'automated-demo-workflow-orchestrator'

export const chatModule: AppChatModule = {
  appId: APP_ID,
  actions: [
    {
      id: 'prepare-demo-workflow',
      appId: APP_ID,
      label: 'Prepare automated demo workflow',
      description:
        'Create a structured App #026 workflow plan for a website/app demo. It reports which reusable stage adapters are currently registered and does not pretend permission-gated capture has already run.',
      keywords: ['demo workflow', 'orchestrate demo', 'automated demo', 'website demo pipeline'],
      canHandle: ({ input }) =>
        /(demo workflow|orchestrate demo|automated demo|website demo pipeline)/i.test(input),
      execute: async ({ input }) => {
        const urlMatch = input.match(/https?:\/\/[^\s]+/i)
        const job = createDemoWorkflowJob({ url: urlMatch?.[0] })
        const state = createInitialWorkflowState(job)
        const registered = listRegisteredWorkflowAdapters().map((adapter) => adapter.stage)

        state.warnings.push(
          `Registered executable stages in this runtime: ${registered.length ? registered.join(', ') : 'none'}.`,
          'Permission-gated screen/tab capture must still be approved interactively by the user.',
        )

        return {
          text: `Prepared an App #026 workflow plan for ${job.url || 'a demo job'}. ${registered.length} reusable stage adapter${registered.length === 1 ? '' : 's'} are currently registered in this runtime.`,
          blob: exportWorkflowState(state),
          fileName: 'automated-demo-workflow-plan.json',
        }
      },
    },
  ],
}

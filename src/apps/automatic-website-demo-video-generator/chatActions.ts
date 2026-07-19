import type { AppChatModule } from '@core/chat/types'
import { createFinalDemoWorkflow } from './lib/orchestratorBridge'

const APP_ID = 'automatic-website-demo-video-generator'

export const chatModule: AppChatModule = {
  appId: APP_ID,
  actions: [
    {
      id: 'prepare-automatic-website-demo',
      appId: APP_ID,
      label: 'Prepare automatic website demo video',
      description:
        'Create the final App #027 demo-video workflow shell for a website URL using the reusable App #026 orchestration pipeline.',
      keywords: ['website demo video', 'automatic demo video', 'generate demo', 'demo website'],
      canHandle: ({ input }) =>
        /(website demo video|automatic demo video|generate demo|demo website)/i.test(input),
      execute: async ({ input }) => {
        const url = input.match(/https?:\/\/[^\s]+/i)?.[0]
        if (!url) {
          return { text: 'Include a website/app URL to prepare the automatic demo-video workflow.' }
        }

        const state = createFinalDemoWorkflow(url)

        return {
          text: `Prepared the final demo-video workflow shell for ${url}. Execution will use App #026 and existing reusable modules; permission-gated capture is not falsely started from chat.`,
          blob: new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
          fileName: 'automatic-website-demo-workflow.json',
        }
      },
    },
  ],
}

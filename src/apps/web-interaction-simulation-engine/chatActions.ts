import type { AppChatModule } from '@core/chat/types'
import { createSampleSequence } from './lib/sampleSequence'
import { parseSequenceJson, sequenceSummary, validateSequence } from './lib/sequenceUtils'

const appId = 'web-interaction-simulation-engine'

function extractJson(input: string) {
  const fenced = input.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const start = input.indexOf('{')
  const end = input.lastIndexOf('}')
  return start >= 0 && end > start ? input.slice(start, end + 1) : ''
}

export const chatModule: AppChatModule = {
  appId,
  actions: [
    {
      id: 'create-sample-demo-sequence',
      appId,
      label: 'Create sample demo interaction sequence',
      description: 'Create a reusable structured sample sequence containing browser-local demo interaction actions.',
      keywords: ['demo sequence', 'interaction sequence', 'simulation actions', 'sample workflow'],
      canHandle: ({ input }) => /(create|generate|make).*(demo|interaction|simulation).*(sequence|actions|workflow)/i.test(input),
      execute: async () => {
        const sequence = createSampleSequence()
        return { text: `Created a reusable sample sequence with ${sequence.actions.length} actions. Open Web Interaction Simulation Engine to visually play or edit it.\n\n${JSON.stringify(sequence, null, 2)}` }
      },
    },
    {
      id: 'validate-demo-sequence',
      appId,
      label: 'Validate demo interaction sequence',
      description: 'Validate a pasted DemoSequence JSON against App #020 reusable action schema.',
      keywords: ['validate demo sequence', 'check interaction json', 'validate simulation actions'],
      canHandle: ({ input }) => /(validate|check).*(demo|interaction|simulation).*(sequence|json|actions)/i.test(input),
      execute: async ({ input }) => {
        const json = extractJson(input)
        if (!json) return { text: 'Paste the DemoSequence JSON in your message so I can validate its structure.' }
        const parsed = parseSequenceJson(json)
        return parsed.valid && parsed.sequence
          ? { text: `Sequence is valid. ${sequenceSummary(parsed.sequence)}` }
          : { text: `Sequence is not valid: ${parsed.errors.join(' ')}` }
      },
    },
    {
      id: 'inspect-demo-sequence',
      appId,
      label: 'Inspect demo interaction sequence',
      description: 'Summarize the action mix in a pasted DemoSequence JSON without executing arbitrary external pages.',
      keywords: ['inspect demo sequence', 'summarize actions', 'interaction plan'],
      canHandle: ({ input }) => /(inspect|summarize|analyse|analyze).*(demo|interaction|simulation).*(sequence|actions|json)/i.test(input),
      execute: async ({ input }) => {
        const json = extractJson(input)
        if (!json) return { text: 'Paste a DemoSequence JSON to inspect it.' }
        try {
          const value = JSON.parse(json) as unknown
          const result = validateSequence(value)
          if (!result.valid || !result.sequence) return { text: `Sequence is not valid: ${result.errors.join(' ')}` }
          return { text: `${sequenceSummary(result.sequence)} Visual playback requires the App #020 simulation surface; the chat action does not pretend to control arbitrary external websites.` }
        } catch (error) {
          return { text: error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON.' }
        }
      },
    },
  ],
}

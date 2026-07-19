import type { AppChatModule } from '@core/chat/types'
import { buildDemoFlows } from './lib/flowBuilder'
import { convertFlowToDemoSequence } from './lib/interactionAdapter'
import {
  exportDemoFlowCollection,
  parsePageFeatureMap,
  validateDemoFlowCollection,
} from './lib/flowValidation'

const APP_ID = 'rule-based-demo-flow-builder'

const isJsonFile = (file: File) =>
  file.type === 'application/json' || /\.json$/i.test(file.name || '')

export const chatModule: AppChatModule = {
  appId: APP_ID,
  actions: [
    {
      id: 'generate-demo-flow',
      appId: APP_ID,
      label: 'Generate rule-based demo flow',
      description:
        'Generate deterministic, editable demo flows from an attached App #021 Page Map / Feature Map JSON without AI.',
      keywords: ['demo flow', 'workflow', 'page map', 'feature map', 'generate flow'],
      requiresFile: true,
      accepts: ['application/json', '.json'],
      canHandle: ({ input, file }) =>
        !!file &&
        isJsonFile(file) &&
        /(demo flow|workflow|page map|feature map|generate flow)/i.test(input),
      execute: async ({ file }) => {
        if (!file || !isJsonFile(file)) {
          return { text: 'Attach an App #021 Page Map / Feature Map JSON file.' }
        }

        try {
          const map = parsePageFeatureMap(await file.text())
          const collection = buildDemoFlows(map)
          const validation = validateDemoFlowCollection(collection)
          const primary = collection.flows.find((flow) => flow.id === collection.primaryFlowId)
          return {
            text: `Generated ${collection.flows.length} deterministic demo flow${collection.flows.length === 1 ? '' : 's'} with ${primary?.steps.length ?? 0} primary steps and ${primary?.assetRequirements.length ?? 0} file-asset requirement${primary?.assetRequirements.length === 1 ? '' : 's'}. Validation: ${validation.valid ? 'valid' : 'needs review'}.`,
            blob: exportDemoFlowCollection(collection),
            fileName: 'rule-based-demo-flows.json',
          }
        } catch (error) {
          return {
            text: error instanceof Error ? error.message : 'Could not generate a demo flow from this JSON.',
          }
        }
      },
    },
    {
      id: 'generate-interaction-sequence',
      appId: APP_ID,
      label: 'Generate App #020 interaction sequence',
      description:
        'Convert an attached App #021 Page Map / Feature Map into a deterministic primary demo flow and App #020-compatible DemoSequence JSON.',
      keywords: ['interaction sequence', 'simulation actions', 'app 020', 'demo actions'],
      requiresFile: true,
      accepts: ['application/json', '.json'],
      canHandle: ({ input, file }) =>
        !!file &&
        isJsonFile(file) &&
        /(interaction sequence|simulation actions|app\s*#?020|demo actions)/i.test(input),
      execute: async ({ file }) => {
        if (!file || !isJsonFile(file)) {
          return { text: 'Attach an App #021 Page Map / Feature Map JSON file.' }
        }

        try {
          const map = parsePageFeatureMap(await file.text())
          const collection = buildDemoFlows(map)
          const primary = collection.flows.find((flow) => flow.id === collection.primaryFlowId) ?? collection.flows[0]
          const sequence = convertFlowToDemoSequence(primary, map)
          return {
            text: `Generated an App #020-compatible DemoSequence with ${sequence.actions.length} structured actions from the primary deterministic flow.`,
            blob: new Blob([JSON.stringify(sequence, null, 2)], { type: 'application/json' }),
            fileName: 'app-020-demo-sequence.json',
          }
        } catch (error) {
          return {
            text: error instanceof Error ? error.message : 'Could not generate the interaction sequence.',
          }
        }
      },
    },
  ],
}

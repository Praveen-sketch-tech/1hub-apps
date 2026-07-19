import type { AppChatModule } from '@core/chat/types'
import {
  buildAssetMappingPlanFromCollection,
  exportAssetMappingPlan,
  parseDemoFlowCollection,
} from './lib/mapper'

const APP_ID = 'smart-asset-to-action-mapper'

const isJsonFile = (file: File) =>
  file.type === 'application/json' || /\.json$/i.test(file.name || '')

export const chatModule: AppChatModule = {
  appId: APP_ID,
  actions: [
    {
      id: 'map-demo-assets',
      appId: APP_ID,
      label: 'Map demo assets to upload actions',
      description:
        'Analyze an attached App #023 Demo Flow collection and create a structured asset-to-action mapping plan for App #017 and App #020.',
      keywords: ['asset mapping', 'map assets', 'demo assets', 'upload actions', 'app 024'],
      requiresFile: true,
      accepts: ['application/json', '.json'],
      canHandle: ({ input, file }) =>
        !!file &&
        isJsonFile(file) &&
        /(asset map|map assets|demo assets|upload actions|app\s*#?024)/i.test(input),
      execute: async ({ file }) => {
        if (!file || !isJsonFile(file)) {
          return { text: 'Attach an App #023 Demo Flow collection JSON file.' }
        }

        try {
          const collection = parseDemoFlowCollection(await file.text())
          const plan = buildAssetMappingPlanFromCollection(collection)
          const pending = plan.mappings.filter((mapping) => mapping.status === 'pending-generation').length

          return {
            text: `Created an asset-to-action mapping plan with ${plan.mappings.length} requirement${plan.mappings.length === 1 ? '' : 's'}. ${pending} asset${pending === 1 ? '' : 's'} are marked for App #017 reusable generation; generation itself is not falsely claimed by this mapping action.`,
            blob: exportAssetMappingPlan(plan),
            fileName: 'asset-to-action-mapping-plan.json',
          }
        } catch (error) {
          return {
            text: error instanceof Error ? error.message : 'Could not create the asset mapping plan.',
          }
        }
      },
    },
  ],
}

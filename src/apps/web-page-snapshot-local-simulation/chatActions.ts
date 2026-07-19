import type { AppChatModule } from '@core/chat/types'
import {
  createSnapshotProject,
  exportSnapshotProject,
  parsePageMap,
} from './lib/snapshotEngine'

const APP_ID = 'web-page-snapshot-local-simulation'

const fileNameOf = (file: File) => file.name?.toLowerCase() || ''

const isHtmlFile = (file: File) =>
  file.type === 'text/html' ||
  file.type === 'application/xhtml+xml' ||
  /\.(html?|xhtml)$/i.test(fileNameOf(file))

const isJsonFile = (file: File) =>
  file.type === 'application/json' || /\.json$/i.test(fileNameOf(file))

export const chatModule: AppChatModule = {
  appId: APP_ID,
  actions: [
    {
      id: 'create-local-snapshot-from-html',
      appId: APP_ID,
      label: 'Create local page snapshot from HTML',
      description:
        'Create a sanitized browser-local snapshot project from an attached HTML file without bypassing website access restrictions.',
      keywords: ['snapshot', 'html snapshot', 'local simulation', 'page snapshot'],
      requiresFile: true,
      accepts: ['text/html', 'application/xhtml+xml', '.html', '.htm', '.xhtml'],
      canHandle: ({ input, file }) =>
        !!file &&
        isHtmlFile(file) &&
        /(snapshot|local simulation|simulate page|html)/i.test(input),
      execute: async ({ file }) => {
        if (!file || !isHtmlFile(file)) {
          return { text: 'Attach an HTML/HTM/XHTML file to create a local snapshot project.' }
        }

        const project = createSnapshotProject({
          name: file.name.replace(/\.(html?|xhtml)$/i, ''),
          html: await file.text(),
          accessMode: 'html-file',
          notes: 'Created through Hub Assistant from a user-provided HTML file.',
        })

        return {
          text: `Created a local snapshot project from ${file.name}. Unsafe executable elements are removed from the stored preview HTML.`,
          blob: exportSnapshotProject(project),
          fileName: `${project.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'snapshot'}-snapshot-project.json`,
        }
      },
    },
    {
      id: 'create-local-snapshot-from-page-map',
      appId: APP_ID,
      label: 'Create local simulation from Page Map',
      description:
        'Turn an attached App #021-style Page Map / Feature Map JSON into a browser-local simulated page snapshot project.',
      keywords: ['page map', 'feature map', 'simulation', 'snapshot project'],
      requiresFile: true,
      accepts: ['application/json', '.json'],
      canHandle: ({ input, file }) =>
        !!file && isJsonFile(file) && /(page map|feature map|simulation|snapshot)/i.test(input),
      execute: async ({ file }) => {
        if (!file || !isJsonFile(file)) {
          return { text: 'Attach a Page Map / Feature Map JSON file.' }
        }

        try {
          const pageMap = parsePageMap(await file.text())
          const project = createSnapshotProject({
            name: pageMap.title ? `${pageMap.title} Simulation` : 'Page Map Simulation',
            pageMap,
            accessMode: 'page-map',
            sourceUrl: pageMap.sourceUrl || pageMap.url,
            title: pageMap.title,
          })

          return {
            text: 'Created a local simulation snapshot project from the attached Page Map / Feature Map.',
            blob: exportSnapshotProject(project),
            fileName: 'page-map-snapshot-project.json',
          }
        } catch (error) {
          return {
            text: error instanceof Error ? error.message : 'Could not parse the attached Page Map JSON.',
          }
        }
      },
    },
  ],
}

import type { AppChatModule } from '@core/chat/types'
import { createZip, extractEntry, isZipFile, loadZip, safeDownloadName } from './lib/archive'

function requireZip(file?: File): File {
  if (!file) throw new Error('Please attach a ZIP file.')
  if (!isZipFile(file)) throw new Error('Please attach a valid .zip file.')
  return file
}

function requestedPath(input: string): string | null {
  const quoted = input.match(/["']([^"']+)["']/)
  if (quoted?.[1]) return quoted[1].trim()

  const match = input.match(/(?:extract|get|download)\s+(?:file\s+)?(.+?)(?:\s+from\s+(?:this\s+)?zip)?$/i)
  const candidate = match?.[1]?.trim()
  if (!candidate || /^(this|the|zip|archive)$/i.test(candidate)) return null
  return candidate
}

export const chatModule: AppChatModule = {
  appId: 'smart-archive-tools',
  actions: [
    {
      id: 'archive-list-files',
      appId: 'smart-archive-tools',
      label: 'List ZIP contents',
      description: 'List files and folders inside an attached ZIP archive.',
      keywords: ['zip', 'archive', 'list', 'contents', 'files'],
      canHandle: ({ input }) =>
        /(?:list|show|view|what).*(?:zip|archive).*(?:files|contents)|(?:zip|archive).*(?:contents|files)/i.test(input),
      execute: async ({ file }) => {
        const zipFile = requireZip(file)
        const { entries } = await loadZip(zipFile)
        const lines = entries.map((entry) => `${entry.isDirectory ? '📁' : '📄'} ${entry.path}`)
        return {
          text: lines.length
            ? `Contents of ${zipFile.name}:\n${lines.join('\n')}`
            : `${zipFile.name} is empty.`,
        }
      },
    },
    {
      id: 'archive-extract-file',
      appId: 'smart-archive-tools',
      label: 'Extract file from ZIP',
      description: 'Extract one named file from an attached ZIP archive.',
      keywords: ['zip', 'archive', 'extract', 'download', 'file'],
      canHandle: ({ input }) =>
        /(?:extract|get|download).*(?:zip|archive)|(?:extract|get|download)\s+file/i.test(input),
      execute: async ({ input, file }) => {
        const zipFile = requireZip(file)
        const path = requestedPath(input)
        if (!path) {
          return { text: 'Tell me the file path to extract, for example: Extract "docs/report.pdf" from this ZIP.' }
        }

        const { zip, entries } = await loadZip(zipFile)
        const exact = entries.find((entry) => !entry.isDirectory && entry.path.toLowerCase() === path.toLowerCase())
        const byName = entries.find((entry) => !entry.isDirectory && entry.name.toLowerCase() === path.toLowerCase())
        const target = exact || byName

        if (!target) {
          return { text: `I could not find "${path}" in ${zipFile.name}. Ask me to list ZIP contents first.` }
        }

        const blob = await extractEntry(zip, target.path)
        return {
          text: `Extracted ${target.path} from ${zipFile.name}.`,
          blob,
          fileName: safeDownloadName(target.path),
        }
      },
    },
    {
      id: 'archive-create-zip',
      appId: 'smart-archive-tools',
      label: 'Create ZIP',
      description: 'Wrap an attached file into a ZIP archive.',
      keywords: ['zip', 'archive', 'compress', 'create'],
      canHandle: ({ input }) =>
        /(?:create|make|bana|banado|zip|compress).*(?:zip|archive)|(?:zip|archive).*(?:create|make|bana)/i.test(input),
      execute: async ({ file }) => {
        if (!file) return { text: 'Please attach a file that you want to put into a ZIP archive.' }
        const blob = await createZip([file])
        const base = file.name.replace(/\.[^/.]+$/, '') || 'archive'
        return {
          text: `Created a ZIP archive containing ${file.name}.`,
          blob,
          fileName: `${base}.zip`,
        }
      },
    },
  ],
}

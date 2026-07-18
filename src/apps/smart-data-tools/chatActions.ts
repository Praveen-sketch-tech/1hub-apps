import type { AppChatModule } from '@core/chat/types'
import {
  parseJson,
  removeDuplicates,
  removeEmptyRows,
} from './lib/data'
import {
  parseCsv,
  toCsv,
} from './lib/csv'

async function loadTable(file: File) {
  const text = await file.text()

  if (
    file.type.includes('json') ||
    file.name.toLowerCase().endsWith('.json')
  ) {
    return parseJson(text)
  }

  return parseCsv(text)
}

export const chatModule: AppChatModule = {
  appId: 'smart-data-tools',
  actions: [
    {
      id: 'data-clean',
      appId: 'smart-data-tools',
      label: 'Clean CSV or JSON data',
      description: 'Remove duplicate and empty rows.',
      keywords: [
        'clean csv',
        'clean json',
        'data clean',
        'remove duplicate rows',
        'remove empty rows',
      ],
      requiresFile: true,
      accepts: ['text/csv', 'application/json'],
      canHandle: ({ input, file }) =>
        Boolean(
          file &&
          /clean csv|clean json|data clean|duplicate rows|empty rows/i.test(input),
        ),
      execute: async ({ input, file }) => {
        if (!file) return null

        let table = await loadTable(file)

        if (
          /duplicate|deduplicate|clean/i.test(input)
        ) {
          table = removeDuplicates(table)
        }

        if (
          /empty|blank|clean/i.test(input)
        ) {
          table = removeEmptyRows(table)
        }

        const csv = toCsv(table)

        return {
          text: `Data cleaned successfully. ${table.rows.length} rows remaining.`,
          blob: new Blob([csv], {
            type: 'text/csv;charset=utf-8',
          }),
          fileName: 'cleaned-data.csv',
        }
      },
    },
    {
      id: 'json-to-csv',
      appId: 'smart-data-tools',
      label: 'Convert JSON to CSV',
      description: 'Convert attached JSON data to CSV.',
      keywords: ['json to csv', 'convert json csv'],
      requiresFile: true,
      accepts: ['application/json'],
      canHandle: ({ input, file }) =>
        Boolean(
          file &&
          /json to csv|convert json.*csv/i.test(input),
        ),
      execute: async ({ file }) => {
        if (!file) return null

        const table = parseJson(await file.text())
        const csv = toCsv(table)

        return {
          text: `JSON converted to CSV. ${table.rows.length} rows.`,
          blob: new Blob([csv], {
            type: 'text/csv;charset=utf-8',
          }),
          fileName: 'converted-data.csv',
        }
      },
    },
  ],
}

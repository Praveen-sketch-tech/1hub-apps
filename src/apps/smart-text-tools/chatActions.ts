import type { AppChatModule } from '@core/chat/types'
import {
  cleanText,
  convertCase,
  removeDuplicateLines,
  sortLines,
  extractValues,
} from './lib/textTransforms'
import {
  formatJson,
  minifyJson,
  validateJson,
} from './lib/jsonTools'

async function getText(input: string, file?: File) {
  if (file) {
    return file.text()
  }

  const colon = input.indexOf(':')
  return colon >= 0 ? input.slice(colon + 1).trim() : ''
}

function textResult(text: string, name = 'result.txt') {
  return {
    text: text.length > 2000
      ? `${text.slice(0, 2000)}\n\n[Output truncated in chat — download full result.]`
      : text,
    blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
    fileName: name,
  }
}

export const chatModule: AppChatModule = {
  appId: 'smart-text-tools',
  actions: [
    {
      id: 'text-clean',
      appId: 'smart-text-tools',
      label: 'Clean text',
      description: 'Clean text or an attached text file.',
      keywords: ['clean text', 'text clean', 'extra spaces', 'blank lines'],
      canHandle: ({ input }) =>
        /clean text|text clean|extra spaces|blank lines/i.test(input),
      execute: async ({ input, file }) => {
        const text = await getText(input, file)

        if (!text) {
          return { text: 'Text paste karo after ":" ya text file attach karo.' }
        }

        return textResult(
          cleanText(text, {
            trimLines: true,
            removeExtraSpaces: true,
            removeBlankLines: true,
            normalizeLineBreaks: true,
            removeHtml: /remove html|html hata/i.test(input),
          }),
          'cleaned-text.txt',
        )
      },
    },
    {
      id: 'text-case',
      appId: 'smart-text-tools',
      label: 'Convert text case',
      description: 'Convert text case.',
      keywords: ['uppercase', 'lowercase', 'title case', 'camel case', 'snake case', 'kebab case'],
      canHandle: ({ input }) =>
        /uppercase|lowercase|title case|camel case|snake case|kebab case/i.test(input),
      execute: async ({ input, file }) => {
        const text = await getText(input, file)

        if (!text) {
          return { text: 'Text paste karo after ":" ya text file attach karo.' }
        }

        const mode =
          /uppercase/i.test(input) ? 'uppercase'
          : /lowercase/i.test(input) ? 'lowercase'
          : /title case/i.test(input) ? 'title'
          : /camel case/i.test(input) ? 'camel'
          : /snake case/i.test(input) ? 'snake'
          : 'kebab'

        return textResult(
          convertCase(text, mode),
          'converted-text.txt',
        )
      },
    },
    {
      id: 'text-deduplicate-lines',
      appId: 'smart-text-tools',
      label: 'Remove duplicate lines',
      description: 'Remove duplicate text lines.',
      keywords: ['duplicate lines', 'remove duplicates'],
      canHandle: ({ input }) =>
        /duplicate lines|remove duplicates/i.test(input),
      execute: async ({ input, file }) => {
        const text = await getText(input, file)

        if (!text) {
          return { text: 'Text paste karo ya text file attach karo.' }
        }

        return textResult(
          removeDuplicateLines(text, {
            caseSensitive: false,
            keepEmpty: false,
          }),
          'deduplicated-text.txt',
        )
      },
    },
    {
      id: 'text-sort-lines',
      appId: 'smart-text-tools',
      label: 'Sort lines',
      description: 'Sort text lines ascending or descending.',
      keywords: ['sort lines', 'lines sort'],
      canHandle: ({ input }) =>
        /sort lines|lines sort/i.test(input),
      execute: async ({ input, file }) => {
        const text = await getText(input, file)

        if (!text) {
          return { text: 'Text paste karo ya text file attach karo.' }
        }

        return textResult(
          sortLines(
            text,
            /desc|descending/i.test(input) ? 'desc' : 'asc',
            {
              numeric: true,
              caseSensitive: false,
            },
          ),
          'sorted-text.txt',
        )
      },
    },
    {
      id: 'text-extract-values',
      appId: 'smart-text-tools',
      label: 'Extract values',
      description: 'Extract emails, URLs or phone numbers.',
      keywords: ['extract emails', 'extract urls', 'extract phones'],
      canHandle: ({ input }) =>
        /extract emails?|extract urls?|extract phones?|phone numbers?/i.test(input),
      execute: async ({ input, file }) => {
        const text = await getText(input, file)

        if (!text) {
          return { text: 'Text paste karo ya text file attach karo.' }
        }

        const mode =
          /email/i.test(input) ? 'emails'
          : /url/i.test(input) ? 'urls'
          : 'numbers'

        const values = extractValues(text, mode)
        const result = values.join('\n')

        return textResult(
          result || 'No matching values found.',
          `extracted-${mode}.txt`,
        )
      },
    },
    {
      id: 'json-tools',
      appId: 'smart-text-tools',
      label: 'JSON tools',
      description: 'Format, minify or validate JSON.',
      keywords: ['format json', 'minify json', 'validate json'],
      canHandle: ({ input }) =>
        /format json|minify json|validate json/i.test(input),
      execute: async ({ input, file }) => {
        const text = await getText(input, file)

        if (!text) {
          return { text: 'JSON paste karo after ":" ya JSON file attach karo.' }
        }

        if (/validate json/i.test(input)) {
          const result = validateJson(text)
          return { text: result.message }
        }

        const result = /minify json/i.test(input)
          ? minifyJson(text)
          : formatJson(text)

        return textResult(
          result,
          /minify/i.test(input)
            ? 'minified.json'
            : 'formatted.json',
        )
      },
    },
  ],
}

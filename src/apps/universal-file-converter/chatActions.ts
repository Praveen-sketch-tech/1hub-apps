import { AppChatModule, ChatActionContext, ChatExecutionResult } from '@core/chat/types';
import { createPdfFromText, convertJsonToCsv, createTextFileBlob } from './utils/converter';

export const chatModule: AppChatModule = {
  appId: 'universal-file-converter',
  actions: [
    {
      id: 'convert-text-to-pdf',
      appId: 'universal-file-converter',
      label: 'Convert Text to PDF',
      description: 'Generates a PDF document directly from raw text input',
      keywords: ['pdf', 'convert text to pdf', 'make pdf', 'generate pdf', 'create pdf'],
      canHandle: (context: ChatActionContext) => {
        const q = context.input.toLowerCase();
        return q.includes('pdf') || q.includes('text to pdf') || q.includes('make pdf');
      },
      execute: async (context: ChatActionContext): Promise<ChatExecutionResult | null> => {
        const text = context.input || 'Sample Document Content';
        const result = createPdfFromText(text, 'Converted_Document');
        return {
          text: `Successfully created PDF document: ${result.filename}`,
          blob: result.blob,
          fileName: result.filename
        };
      }
    },
    {
      id: 'convert-json-to-csv',
      appId: 'universal-file-converter',
      label: 'Convert JSON to CSV',
      description: 'Parses JSON array and outputs a downloadable CSV file',
      keywords: ['json to csv', 'csv convert', 'convert json', 'export csv'],
      canHandle: (context: ChatActionContext) => {
        const q = context.input.toLowerCase();
        return q.includes('json to csv') || q.includes('convert json') || q.includes('export csv');
      },
      execute: async (context: ChatActionContext): Promise<ChatExecutionResult | null> => {
        try {
          const csvText = convertJsonToCsv(context.input);
          const result = createTextFileBlob(csvText, 'converted_data', 'csv');
          return {
            text: 'Successfully converted JSON data to CSV format.',
            blob: result.blob,
            fileName: result.filename
          };
        } catch (err) {
          return {
            text: `JSON to CSV conversion failed: ${(err as Error).message}`
          };
        }
      }
    },
    {
      id: 'create-markdown-file',
      appId: 'universal-file-converter',
      label: 'Create Markdown File',
      description: 'Converts text input into a formatted .md download file',
      keywords: ['markdown', 'make md', 'convert md', 'create markdown'],
      canHandle: (context: ChatActionContext) => {
        const q = context.input.toLowerCase();
        return q.includes('markdown') || q.includes('make md') || q.includes('create md');
      },
      execute: async (context: ChatActionContext): Promise<ChatExecutionResult | null> => {
        const content = context.input || '';
        const result = createTextFileBlob(content, 'notes', 'md');
        return {
          text: `Successfully generated markdown file: ${result.filename}`,
          blob: result.blob,
          fileName: result.filename
        };
      }
    }
  ]
};

export default chatModule;

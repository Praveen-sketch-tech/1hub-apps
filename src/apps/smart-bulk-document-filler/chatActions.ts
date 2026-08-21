import { AppChatModule, ChatActionContext, ChatExecutionResult } from '@core/chat/types';
import { parseAnyDocument } from './services/documentDispatcher';

export const chatModule: AppChatModule = {
  appId: 'smart-bulk-document-filler',
  actions: [
    {
      id: 'extract-fields',
      appId: 'smart-bulk-document-filler',
      label: 'Extract Fields from Document',
      description: 'Lists the label:value pairs found in an attached Word, Excel, or fillable PDF document',
      keywords: ['extract fields', 'document fields', 'find labels', 'bulk fill', 'document filler'],
      requiresFile: true,
      accepts: ['.docx', '.xlsx', '.pdf'],
      canHandle: (context: ChatActionContext) => !!context.file,
      execute: async (context: ChatActionContext): Promise<ChatExecutionResult | null> => {
        if (!context.file) {
          return { text: 'Attach a .docx, .xlsx, or fillable .pdf file to extract its fields.' };
        }

        const { doc, fields } = await parseAnyDocument(context.file, 0);
        if (doc.kind === 'unsupported') {
          return { text: `Couldn't process this file: ${doc.unsupportedReason}` };
        }

        if (fields.length === 0) {
          return { text: 'No label:value fields were found in this document.' };
        }

        const lines = fields.map((f) => `${f.rawLabel}: ${f.value || '(empty)'}`);
        return { text: `Found ${fields.length} field(s):\n${lines.join('\n')}` };
      }
    }
  ]
};

export default chatModule;

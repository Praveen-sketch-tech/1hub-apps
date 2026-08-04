import { AppChatModule, ChatActionContext, ChatExecutionResult } from '@core/chat/types';
import { parseMarkdownToHtml, generateFullHtmlDocument } from './utils/markdown';

export const chatModule: AppChatModule = {
  appId: 'markdown-live-previewer',
  actions: [
    {
      id: 'convert-markdown-to-html',
      appId: 'markdown-live-previewer',
      label: 'Convert Markdown to HTML',
      description: 'Renders Markdown input into a downloadable, styled HTML document',
      keywords: ['markdown to html', 'convert markdown', 'render markdown', 'markdown preview'],
      canHandle: (context: ChatActionContext) => {
        const q = context.input.toLowerCase();
        return q.includes('markdown to html') || q.includes('convert markdown') || q.includes('render markdown');
      },
      execute: async (context: ChatActionContext): Promise<ChatExecutionResult | null> => {
        const bodyHtml = parseMarkdownToHtml(context.input);
        const fullDocument = generateFullHtmlDocument(bodyHtml);
        const blob = new Blob([fullDocument], { type: 'text/html;charset=utf-8' });
        return {
          text: 'Successfully converted Markdown to a styled HTML document.',
          blob,
          fileName: 'markdown-preview.html'
        };
      }
    }
  ]
};

export default chatModule;
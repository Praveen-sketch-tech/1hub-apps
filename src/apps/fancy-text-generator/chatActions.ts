import { AppChatModule, ChatActionContext, ChatExecutionResult } from '@core/chat/types';
import { TEXT_STYLES } from './services/textStyler';

export const chatModule: AppChatModule = {
  appId: 'fancy-text-generator',
  actions: [
    {
      id: 'stylize-text',
      appId: 'fancy-text-generator',
      label: 'Make Text Fancy',
      description: 'Converts plain text into stylish Unicode fonts (bold, script, bubble, etc.)',
      keywords: ['fancy text', 'stylish font', 'cool font', 'bold text', 'unicode font'],
      canHandle: (context: ChatActionContext) => {
        const q = context.input.toLowerCase();
        return q.includes('fancy text') || q.includes('stylish') || q.includes('cool font') || q.includes('fancy font');
      },
      execute: async (context: ChatActionContext): Promise<ChatExecutionResult | null> => {
        const source = context.input.replace(/fancy text|stylish|cool font|fancy font/gi, '').trim() || 'Hello World';
        const preview = TEXT_STYLES.slice(0, 8)
          .map((s) => `${s.label}: ${s.apply(source)}`)
          .join('\n');
        return { text: preview };
      }
    }
  ]
};

export default chatModule;

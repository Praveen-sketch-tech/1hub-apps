import { createPdfFromText, convertJsonToCsv, createTextFileBlob } from './utils/converter';
export interface ChatActionContext {
query: string;
payload?: Record<string, any>;
}
export interface ChatActionResult {
success: boolean;
message: string;
downloadUrl?: string;
filename?: string;
}
export interface ChatAction {
id: string;
label: string;
description: string;
keywords: string[];
canHandle: (query: string) => boolean;
execute: (context: ChatActionContext) => Promise<ChatActionResult>;
}
export interface AppChatModule {
appId: string;
appName: string;
actions: ChatAction[];
}
export const chatActions: ChatAction[] = [
{
id: 'convert-text-to-pdf',
label: 'Convert Text to PDF',
description: 'Generates a PDF document directly from raw text input',
keywords: ['pdf', 'convert text to pdf', 'make pdf', 'generate pdf', 'create pdf'],
canHandle: (query: string) => {
const q = query.toLowerCase();
return q.includes('pdf') || q.includes('text to pdf') || q.includes('make pdf');
},
execute: async (context: ChatActionContext): Promise<ChatActionResult> => {
const text = context.payload?.text || context.query || 'Sample Document Content';
const title = context.payload?.title || 'Converted_Document';
const result = createPdfFromText(text, title);
return {
success: true,
message: Successfully created PDF document: ${result.filename},
downloadUrl: result.url,
filename: result.filename,
};
},
},
{
id: 'convert-json-to-csv',
label: 'Convert JSON to CSV',
description: 'Parses JSON array and outputs a downloadable CSV file',
keywords: ['json to csv', 'csv convert', 'convert json', 'export csv'],
canHandle: (query: string) => {
const q = query.toLowerCase();
return q.includes('json to csv') || q.includes('convert json') || q.includes('export csv');
},
execute: async (context: ChatActionContext): Promise<ChatActionResult> => {
const jsonStr = context.payload?.json || context.query;
try {
const csvText = convertJsonToCsv(jsonStr);
const result = createTextFileBlob(csvText, 'converted_data', 'csv');
return {
success: true,
message: 'Successfully converted JSON data to CSV format.',
downloadUrl: result.url,
filename: result.filename,
};
} catch (err) {
return {
success: false,
message: JSON to CSV conversion failed: ${(err as Error).message},
};
}
},
},
{
id: 'create-markdown-file',
label: 'Create Markdown File',
description: 'Converts text input into a formatted .md download file',
keywords: ['markdown', 'make md', 'convert md', 'create markdown'],
canHandle: (query: string) => {
const q = query.toLowerCase();
return q.includes('markdown') || q.includes('make md') || q.includes('create md');
},
execute: async (context: ChatActionContext): Promise<ChatActionResult> => {
const content = context.payload?.text || context.query;
const title = context.payload?.title || 'notes';
const result = createTextFileBlob(content, title, 'md');
return {
success: true,
message: Successfully generated markdown file: ${result.filename},
downloadUrl: result.url,
filename: result.filename,
};
},
},
];
export const chatModule: AppChatModule = {
appId: 'universal-file-converter',
appName: 'Universal File Converter',
actions: chatActions,
};
export default chatModule;
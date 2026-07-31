import { NodeDefinition, Workflow } from './types';

export const NODE_LIBRARY: NodeDefinition[] = [
  {
    type: 'start',
    title: 'Start Workflow',
    category: 'Logic',
    description: 'Trigger point for workflow execution',
    color: 'bg-emerald-500/10 border-emerald-500 text-emerald-400',
    icon: 'Play',
    inputs: [],
    outputs: [{ name: 'Trigger', type: 'output', dataType: 'any' }],
    defaultConfig: { triggerOn: 'manual' }
  },
  {
    type: 'end',
    title: 'End Workflow',
    category: 'Logic',
    description: 'Final execution node',
    color: 'bg-rose-500/10 border-rose-500 text-rose-400',
    icon: 'Square',
    inputs: [{ name: 'In', type: 'input', dataType: 'any' }],
    outputs: [],
    defaultConfig: { storeResult: true }
  },
  {
    type: 'upload',
    title: 'Upload File',
    category: 'Input/Output',
    description: 'Upload files (PDF, JPG, PNG, CSV)',
    color: 'bg-blue-500/10 border-blue-500 text-blue-400',
    icon: 'Upload',
    inputs: [{ name: 'Trigger', type: 'input', dataType: 'any' }],
    outputs: [{ name: 'File', type: 'output', dataType: 'file' }],
    defaultConfig: { accept: '.pdf,.png,.jpg,.jpeg', maxMb: 10 }
  },
  {
    type: 'image',
    title: 'Image Processor',
    category: 'Processing',
    description: 'Resize, crop, and convert image files',
    color: 'bg-cyan-500/10 border-cyan-500 text-cyan-400',
    icon: 'Image',
    inputs: [{ name: 'Image In', type: 'input', dataType: 'file' }],
    outputs: [{ name: 'Image Out', type: 'output', dataType: 'file' }],
    defaultConfig: { width: 1024, height: 768, format: 'webp' }
  },
  {
    type: 'pdf',
    title: 'PDF Parser',
    category: 'Processing',
    description: 'Extract pages, text, and metadata from PDF',
    color: 'bg-red-500/10 border-red-500 text-red-400',
    icon: 'FileText',
    inputs: [{ name: 'PDF File', type: 'input', dataType: 'file' }],
    outputs: [
      { name: 'Text Data', type: 'output', dataType: 'string' },
      { name: 'Metadata', type: 'output', dataType: 'object' }
    ],
    defaultConfig: { extractImages: false, maxPages: 50 }
  },
  {
    type: 'ocr',
    title: 'OCR Reader',
    category: 'Processing',
    description: 'Extract raw text from images & document scans',
    color: 'bg-amber-500/10 border-amber-500 text-amber-400',
    icon: 'Scan',
    inputs: [{ name: 'Document', type: 'input', dataType: 'file' }],
    outputs: [{ name: 'Raw Text', type: 'output', dataType: 'string' }],
    defaultConfig: { language: 'eng', psm: 3 }
  },
  {
    type: 'ai',
    title: 'AI Processing Agent',
    category: 'Processing',
    description: 'LLM Prompt, Summarize, Transform or Classify',
    color: 'bg-purple-500/10 border-purple-500 text-purple-400',
    icon: 'Cpu',
    inputs: [{ name: 'Prompt Input', type: 'input', dataType: 'any' }],
    outputs: [{ name: 'AI Output', type: 'output', dataType: 'string' }],
    defaultConfig: {
      systemPrompt: 'You are an AI data assistant.',
      userPrompt: 'Extract key insights from this data: {{input}}',
      model: 'gpt-4o'
    }
  },
  {
    type: 'api',
    title: 'REST API Request',
    category: 'Integrations',
    description: 'Send HTTP GET/POST Webhook requests',
    color: 'bg-indigo-500/10 border-indigo-500 text-indigo-400',
    icon: 'Globe',
    inputs: [{ name: 'Payload', type: 'input', dataType: 'object' }],
    outputs: [
      { name: 'Response', type: 'output', dataType: 'object' },
      { name: 'Status', type: 'output', dataType: 'number' }
    ],
    defaultConfig: {
      url: 'https://api.example.com/webhook',
      method: 'POST',
      headers: '{"Content-Type": "application/json"}'
    }
  },
  {
    type: 'condition',
    title: 'Condition Logic',
    category: 'Logic',
    description: 'Branch flow based on boolean expression',
    color: 'bg-yellow-500/10 border-yellow-500 text-yellow-400',
    icon: 'GitBranch',
    inputs: [{ name: 'Value', type: 'input', dataType: 'any' }],
    outputs: [
      { name: 'True', type: 'output', dataType: 'any' },
      { name: 'False', type: 'output', dataType: 'any' }
    ],
    defaultConfig: { operator: 'contains', value: 'Invoice' }
  },
  {
    type: 'delay',
    title: 'Delay Timer',
    category: 'Logic',
    description: 'Pause execution workflow by specified milliseconds',
    color: 'bg-orange-500/10 border-orange-500 text-orange-400',
    icon: 'Clock',
    inputs: [{ name: 'In', type: 'input', dataType: 'any' }],
    outputs: [{ name: 'Out', type: 'output', dataType: 'any' }],
    defaultConfig: { durationMs: 1500 }
  },
  {
    type: 'download',
    title: 'Download File',
    category: 'Input/Output',
    description: 'Save output payload directly as downloadable asset',
    color: 'bg-teal-500/10 border-teal-500 text-teal-400',
    icon: 'Download',
    inputs: [{ name: 'Data', type: 'input', dataType: 'any' }],
    outputs: [],
    defaultConfig: { filename: 'workflow_output.json', format: 'json' }
  }
];

export const PRESET_WORKFLOWS: Workflow[] = [
  {
    id: 'preset-ocr-ai-summary',
    name: 'PDF OCR & AI Summarizer',
    description: 'Extracts scanned text from documents, summarizes with AI, and exports JSON',
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-start',
        type: 'start',
        title: 'Start Workflow',
        x: 100,
        y: 200,
        inputs: [],
        outputs: [{ id: 'out-start', name: 'Trigger', type: 'output', dataType: 'any' }],
        config: { triggerOn: 'manual' }
      },
      {
        id: 'node-upload',
        type: 'upload',
        title: 'Upload File',
        x: 320,
        y: 200,
        inputs: [{ id: 'in-up-1', name: 'Trigger', type: 'input', dataType: 'any' }],
        outputs: [{ id: 'out-up-1', name: 'File', type: 'output', dataType: 'file' }],
        config: { accept: '.pdf,.png,.jpg', fileName: 'sample_invoice.pdf' }
      },
      {
        id: 'node-ocr',
        type: 'ocr',
        title: 'OCR Reader',
        x: 560,
        y: 200,
        inputs: [{ id: 'in-ocr-1', name: 'Document', type: 'input', dataType: 'file' }],
        outputs: [{ id: 'out-ocr-1', name: 'Raw Text', type: 'output', dataType: 'string' }],
        config: { language: 'eng' }
      },
      {
        id: 'node-ai',
        type: 'ai',
        title: 'AI Summarizer',
        x: 800,
        y: 200,
        inputs: [{ id: 'in-ai-1', name: 'Prompt Input', type: 'input', dataType: 'any' }],
        outputs: [{ id: 'out-ai-1', name: 'AI Output', type: 'output', dataType: 'string' }],
        config: { model: 'gpt-4o', userPrompt: 'Extract summary and line items' }
      },
      {
        id: 'node-download',
        type: 'download',
        title: 'Download Result',
        x: 1050,
        y: 200,
        inputs: [{ id: 'in-dl-1', name: 'Data', type: 'input', dataType: 'any' }],
        outputs: [],
        config: { filename: 'summary_report.json' }
      }
    ],
    edges: [
      { id: 'e1', sourceNodeId: 'node-start', sourcePortId: 'out-start', targetNodeId: 'node-upload', targetPortId: 'in-up-1' },
      { id: 'e2', sourceNodeId: 'node-upload', sourcePortId: 'out-up-1', targetNodeId: 'node-ocr', targetPortId: 'in-ocr-1' },
      { id: 'e3', sourceNodeId: 'node-ocr', sourcePortId: 'out-ocr-1', targetNodeId: 'node-ai', targetPortId: 'in-ai-1' },
      { id: 'e4', sourceNodeId: 'node-ai', sourcePortId: 'out-ai-1', targetNodeId: 'node-download', targetPortId: 'in-dl-1' }
    ]
  }
];

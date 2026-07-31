export type NodeType =
  | 'start'
  | 'end'
  | 'upload'
  | 'image'
  | 'pdf'
  | 'ocr'
  | 'ai'
  | 'api'
  | 'condition'
  | 'delay'
  | 'download';

export interface Port {
  id: string;
  name: string;
  type: 'input' | 'output';
  dataType?: 'string' | 'number' | 'object' | 'file' | 'boolean' | 'any';
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  title: string;
  x: number;
  y: number;
  inputs: Port[];
  outputs: Port[];
  config: Record<string, any>;
  status?: 'idle' | 'running' | 'completed' | 'failed';
  lastOutput?: any;
}

export interface Edge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  nodes: WorkflowNode[];
  edges: Edge[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  nodeId: string;
  nodeTitle: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
  data?: any;
}

export interface NodeDefinition {
  type: NodeType;
  title: string;
  category: 'Input/Output' | 'Processing' | 'Logic' | 'Integrations';
  description: string;
  color: string;
  icon: string;
  inputs: Omit<Port, 'id'>[];
  outputs: Omit<Port, 'id'>[];
  defaultConfig: Record<string, any>;
}

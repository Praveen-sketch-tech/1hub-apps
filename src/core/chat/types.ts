export interface ChatExecutionStep {
  input: string
  ok: boolean
  text: string
  appId?: string
  actionId?: string
  label?: string
}

export interface ChatExecutionResult {
  text: string
  blob?: Blob
  fileName?: string
  mimeType?: string
  steps?: ChatExecutionStep[]
  handledBy?: { appId: string; actionId: string; label: string }
}

export interface ChatActionContext {
  input: string
  file?: File
  previousResult?: ChatExecutionResult | null
  stepIndex?: number
}

export interface AppChatAction {
  id: string
  appId: string
  label: string
  description: string
  keywords: string[]
  requiresFile?: boolean
  accepts?: string[]
  canHandle: (context: ChatActionContext) => boolean
  execute: (context: ChatActionContext) => Promise<ChatExecutionResult | null> | ChatExecutionResult | null
}

export interface AppChatModule { appId: string; actions: AppChatAction[] }

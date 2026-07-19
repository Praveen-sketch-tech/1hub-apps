export interface ChatExecutionResult {
  text: string
  blob?: Blob
  fileName?: string
}

export interface ChatActionContext {
  input: string
  file?: File
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
  execute: (
    context: ChatActionContext,
  ) => Promise<ChatExecutionResult | null> | ChatExecutionResult | null
}

export interface AppChatModule {
  appId: string
  actions: AppChatAction[]
}

import { executeRegisteredChatAction } from './appChatModules'
import type { ChatExecutionResult } from './types'

export type { ChatExecutionResult } from './types'

export async function executeChatRequest(
  input: string,
  file?: File,
): Promise<ChatExecutionResult | null> {
  return executeRegisteredChatAction({
    input,
    file,
  })
}

import {
  executeRegisteredChatAction,
  getRegisteredChatCapabilities,
} from './appChatModules'
import type { ChatExecutionResult } from './types'

export type { ChatExecutionResult } from './types'

export async function executeChatRequest(
  input: string,
  file?: File,
): Promise<ChatExecutionResult | null> {
  const normalized = input.trim().toLowerCase()

  const isCapabilityRequest =
    /^(help|what can you do|what can u do|available tools|available commands|capabilities|tum kya kya kar sakte ho|tum kya kar sakte ho|kya kya kar sakte ho|kya kya tools hain|kya kya tools hai|kya kar sakte ho)[?.! ]*$/i.test(
      normalized,
    )

  if (isCapabilityRequest) {
    const capabilities = await getRegisteredChatCapabilities()

    if (!capabilities.length) {
      return {
        text: 'Abhi koi chat actions available nahi hain.',
      }
    }

    const grouped = new Map<
      string,
      Array<{
        label: string
        description: string
      }>
    >()

    for (const capability of capabilities) {
      const actions = grouped.get(capability.appId) ?? []

      actions.push({
        label: capability.label,
        description: capability.description,
      })

      grouped.set(capability.appId, actions)
    }

    const sections = [...grouped.entries()].map(
      ([appId, actions]) => {
        const lines = actions.map(
          (action) =>
            `• ${action.label} — ${action.description}`,
        )

        return `${appId}\n${lines.join('\n')}`
      },
    )

    return {
      text:
        `Main currently ${capabilities.length} chat actions use kar sakta hoon:\n\n` +
        sections.join('\n\n') +
        '\n\nFile-based tool use karne ke liye file attach karke command likho.',
    }
  }

  return executeRegisteredChatAction({
    input,
    file,
  })
}

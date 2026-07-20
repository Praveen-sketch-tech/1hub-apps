import { executeRegisteredChatAction, getRegisteredChatCapabilities } from './appChatModules'
import type { ChatExecutionResult, ChatExecutionStep } from './types'
export type { ChatExecutionResult } from './types'

function splitChain(input: string): string[] {
  return input.split(/(?:\s+(?:and then|then|and|aur|phir)\s+|\s*→\s*|\s*=>\s*|\s*;\s*)/i).map((part) => part.trim()).filter(Boolean)
}

function toFile(result: ChatExecutionResult | null, fallback?: File): File | undefined {
  if (!result?.blob) return fallback
  return new File([result.blob], result.fileName || fallback?.name || 'chat-output.bin', {
    type: result.mimeType || result.blob.type || fallback?.type || 'application/octet-stream',
  })
}

export async function executeChatRequest(input: string, file?: File): Promise<ChatExecutionResult | null> {
  const normalized = input.trim().toLowerCase()
  const isCapabilityRequest = /^(help|what can you do|what can u do|available tools|available commands|capabilities|tum kya kya kar sakte ho|tum kya kar sakte ho|kya kya kar sakte ho|kya kya tools hain|kya kya tools hai|kya kar sakte ho)[?.! ]*$/i.test(normalized)
  if (isCapabilityRequest) {
    const capabilities = await getRegisteredChatCapabilities()
    if (!capabilities.length) return { text: 'Abhi koi chat actions available nahi hain.' }
    const grouped = new Map<string, Array<{ label: string; description: string }>>()
    for (const capability of capabilities) {
      const actions = grouped.get(capability.appId) ?? []
      actions.push({ label: capability.label, description: capability.description })
      grouped.set(capability.appId, actions)
    }
    const sections = [...grouped.entries()].map(([appId, actions]) => `${appId}\n${actions.map((a) => `• ${a.label} — ${a.description}`).join('\n')}`)
    return { text: `Main currently ${capabilities.length} chat actions use kar sakta hoon:\n\n${sections.join('\n\n')}\n\nFile-based tool use karne ke liye file attach karke command likho.` }
  }

  // Give app actions the complete request first. Combined-capability actions (for
  // example image compress + convert) can finish in one browser processing pass.
  const direct = await executeRegisteredChatAction({ input, file })
  if (direct) return direct

  const parts = splitChain(input)
  if (parts.length <= 1) return null

  const steps: ChatExecutionStep[] = []
  let previous: ChatExecutionResult | null = null
  let currentFile = file
  for (let index = 0; index < parts.length; index += 1) {
    const stepInput = parts[index]
    const result = await executeRegisteredChatAction({ input: stepInput, file: currentFile, previousResult: previous, stepIndex: index })
    if (!result) {
      steps.push({ input: stepInput, ok: false, text: 'No connected action could handle this step.' })
      return {
        text: steps.map((step, i) => `${i + 1}. ${step.ok ? '✓' : '✗'} ${step.input} — ${step.text}`).join('\n') + `\n\nStopped at step ${index + 1} of ${parts.length}.`,
        blob: previous?.blob, fileName: previous?.fileName, mimeType: previous?.mimeType, steps,
      }
    }
    steps.push({ input: stepInput, ok: true, text: result.text, appId: result.handledBy?.appId, actionId: result.handledBy?.actionId, label: result.handledBy?.label })
    previous = result
    currentFile = toFile(result, currentFile)
  }
  return { ...previous, steps, text: steps.map((step, i) => `${i + 1}. ✓ ${step.input} — ${step.text}`).join('\n') + (previous?.fileName ? `\n\nFinal output: ${previous.fileName}` : '') }
}

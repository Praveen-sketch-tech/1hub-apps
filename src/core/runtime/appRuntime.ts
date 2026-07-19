import type { ChatActionContext, ChatExecutionResult } from '@core/chat/types'

export interface AppRuntimeAction {
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

export interface AppRuntimeModule {
  appId: string
  actions: AppRuntimeAction[]
}

const runtimeLoaders = new Map<string, () => Promise<AppRuntimeModule>>()

export function registerAppRuntime(appId: string, loader: () => Promise<AppRuntimeModule>) {
  runtimeLoaders.set(appId, loader)
}

export function hasAppRuntime(appId: string) {
  return runtimeLoaders.has(appId)
}

export async function loadAppRuntime(appId: string) {
  return runtimeLoaders.get(appId)?.() ?? null
}

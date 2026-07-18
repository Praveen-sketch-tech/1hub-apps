import { APP_REGISTRY } from '@core/apps/appRegistry'

export interface ChatCommand {
  id: string
  input: string
  appId: string
  actionId?: string
  createdAt: number
}

export interface ChatAction {
  id: string
  appId: string
  label: string
  description: string
  keywords: string[]
  run?: (input: string) => Promise<string> | string
}

type AppCommandHandler = (
  command: ChatCommand,
) => Promise<string | void> | string | void

const actions: ChatAction[] = []
const handlers = new Map<string, AppCommandHandler>()

const PENDING_KEY = '1hub_pending_chat_command'

export function registerChatAction(action: ChatAction) {
  const index = actions.findIndex((item) => item.id === action.id)

  if (index >= 0) {
    actions[index] = action
  } else {
    actions.push(action)
  }
}

export function unregisterChatAction(id: string) {
  const index = actions.findIndex((item) => item.id === id)

  if (index >= 0) {
    actions.splice(index, 1)
  }
}

export function getChatActions() {
  return [...actions]
}

export function findChatAction(input: string) {
  const normalized = input.trim().toLowerCase()

  return actions.find((action) =>
    action.keywords.some((keyword) =>
      normalized.includes(keyword.toLowerCase()),
    ),
  )
}

export function findAppForInput(input: string) {
  const normalized = input.trim().toLowerCase()

  return APP_REGISTRY.find((app) => {
    const candidates = [
      app.id,
      app.name,
      ...app.tags,
    ]

    return candidates.some((value) =>
      normalized.includes(value.toLowerCase()),
    )
  })
}

export function registerAppCommandHandler(
  appId: string,
  handler: AppCommandHandler,
) {
  handlers.set(appId, handler)

  return () => {
    handlers.delete(appId)
  }
}

export async function executeAppCommand(command: ChatCommand) {
  const handler = handlers.get(command.appId)

  if (!handler) {
    return null
  }

  return handler(command)
}

export function savePendingChatCommand(command: ChatCommand) {
  sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify(command),
  )
}

export function consumePendingChatCommand(appId: string) {
  const raw = sessionStorage.getItem(PENDING_KEY)

  if (!raw) {
    return null
  }

  try {
    const command = JSON.parse(raw) as ChatCommand

    if (command.appId !== appId) {
      return null
    }

    sessionStorage.removeItem(PENDING_KEY)

    return command
  } catch {
    sessionStorage.removeItem(PENDING_KEY)
    return null
  }
}

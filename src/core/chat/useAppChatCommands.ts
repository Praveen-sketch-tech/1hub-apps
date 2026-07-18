import { useEffect } from 'react'
import {
  consumePendingChatCommand,
  registerAppCommandHandler,
  type ChatCommand,
} from './chatRegistry'

export function useAppChatCommands(
  appId: string,
  handler: (
    command: ChatCommand,
  ) => Promise<string | void> | string | void,
) {
  useEffect(() => {
    const unregister = registerAppCommandHandler(
      appId,
      handler,
    )

    const pending = consumePendingChatCommand(appId)

    if (pending) {
      void Promise.resolve(handler(pending))
    }

    return unregister
  }, [appId, handler])
}

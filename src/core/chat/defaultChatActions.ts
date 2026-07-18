import { APP_REGISTRY } from '@core/apps/appRegistry'
import { registerChatAction } from './chatRegistry'

let registered = false

export function registerDefaultChatActions() {
  if (registered) {
    return
  }

  registered = true

  for (const app of APP_REGISTRY) {
    registerChatAction({
      id: `open-${app.id}`,
      appId: app.id,
      label: app.name,
      description: app.description,
      keywords: [
        app.name,
        app.id,
        ...app.tags,
      ],
    })
  }
}

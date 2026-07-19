import type {
  AppChatModule,
  ChatActionContext,
  ChatExecutionResult,
} from './types'

type ChatModuleLoader = () => Promise<AppChatModule>

const CHAT_MODULE_LOADERS: Record<string, ChatModuleLoader> = {}

export function registerAppChatModule(
  appId: string,
  loader: ChatModuleLoader,
) {
  CHAT_MODULE_LOADERS[appId] = loader
}

export function hasAppChatModule(appId: string) {
  return Boolean(CHAT_MODULE_LOADERS[appId])
}

export async function executeRegisteredChatAction(
  context: ChatActionContext,
): Promise<ChatExecutionResult | null> {
  for (const loader of Object.values(CHAT_MODULE_LOADERS)) {
    const module = await loader()

    for (const action of module.actions) {
      if (action.canHandle(context)) {
        return action.execute(context)
      }
    }
  }

  return null
}


// Existing Apps #001–#010
registerAppChatModule('smart-image-tools', async () => {
  const module = await import('@apps/smart-image-tools/chatActions')
  return module.chatModule
})

registerAppChatModule('smart-pdf-tools', async () => {
  const module = await import('@apps/smart-pdf-tools/chatActions')
  return module.chatModule
})

registerAppChatModule('qr-barcode-studio', async () => {
  const module = await import('@apps/qr-barcode-studio/chatActions')
  return module.chatModule
})

registerAppChatModule('smart-text-tools', async () => {
  const module = await import('@apps/smart-text-tools/chatActions')
  return module.chatModule
})

registerAppChatModule('smart-data-tools', async () => {
  const module = await import('@apps/smart-data-tools/chatActions')
  return module.chatModule
})

registerAppChatModule('smart-calculator-converter', async () => {
  const module = await import('@apps/smart-calculator-converter/chatActions')
  return module.chatModule
})

registerAppChatModule('app-007-smart-file-tools', async () => {
  const module = await import('@apps/smart-file-tools/chatActions')
  return module.chatModule
})

registerAppChatModule('smart-document-scanner-ocr', async () => {
  const module = await import('@apps/smart-document-scanner-ocr/chatActions')
  return module.chatModule
})

registerAppChatModule('smart-audio-tools', async () => {
  const module = await import('@apps/smart-audio-tools/chatActions')
  return module.chatModule
})

registerAppChatModule('smart-video-tools', async () => {
  const module = await import('@apps/smart-video-tools/chatActions')
  return module.chatModule
})


export async function getRegisteredChatCapabilities(): Promise<
  Array<{
    appId: string
    label: string
    description: string
  }>
> {
  const capabilities: Array<{
    appId: string
    label: string
    description: string
  }> = []

  for (const [appId, loader] of Object.entries(CHAT_MODULE_LOADERS)) {
    try {
      const module = await loader()

      for (const action of module.actions) {
        capabilities.push({
          appId,
          label: action.label,
          description: action.description,
        })
      }
    } catch {
      // Ignore a module that cannot be loaded.
    }
  }

  return capabilities
}

registerAppChatModule(
  'smart-password-generator',
  async () => {
    const module = await import('@apps/smart-password-generator/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'smart-uuid-generator',
  async () => {
    const module = await import('@apps/smart-uuid-generator/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'smart-metadata-privacy-tools',
  async () => {
    const module = await import('@apps/smart-metadata-privacy-tools/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'smart-archive-tools',
  async () => {
    const module = await import('@apps/smart-archive-tools/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'smart-network-web-tools',
  async () => {
    const module = await import('@apps/smart-network-web-tools/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'smart-screenshot-tools',
  async () => {
    const module = await import('@apps/smart-screenshot-tools/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'smart-color-design-tools',
  async () => {
    const module = await import('@apps/smart-color-design-tools/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'universal-test-asset-factory',
  async () => {
    const module = await import('@apps/universal-test-asset-factory/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'local-screen-tab-recorder',
  async () => {
    const module = await import('@apps/local-screen-tab-recorder/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'browser-video-processing-studio',
  async () => {
    const module = await import('@apps/browser-video-processing-studio/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'web-interaction-simulation-engine',
  async () => {
    const module = await import('@apps/web-interaction-simulation-engine/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'website-structure-feature-analyzer',
  async () => {
    const module = await import('@apps/website-structure-feature-analyzer/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'web-page-snapshot-local-simulation',
  async () => {
    const module = await import('@apps/web-page-snapshot-local-simulation/chatActions')
    return module.chatModule
  },
)

registerAppChatModule(
  'rule-based-demo-flow-builder',
  async () => {
    const module = await import('@apps/rule-based-demo-flow-builder/chatActions')
    return module.chatModule
  },
)

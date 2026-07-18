import { FormEvent, useState } from 'react'
import { APP_REGISTRY } from '@core/apps/appRegistry'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  findAppForInput,
  findChatAction,
  savePendingChatCommand,
} from '@core/chat/chatRegistry'
import { registerDefaultChatActions } from '@core/chat/defaultChatActions'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
}

interface GlobalToolChatProps {
  mode?: 'dashboard' | 'floating'
}

export function GlobalToolChat({
  mode = 'floating',
}: GlobalToolChatProps) {
  const location = useLocation()
  const navigate = useNavigate()

  registerDefaultChatActions()

  const [isOpen, setIsOpen] = useState(mode === 'dashboard')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: 'assistant',
      text: 'What do you want to do? I can help you find and use tools across 1 Hub Apps.',
    },
  ])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const value = input.trim()
    if (!value) return

    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        role: 'user',
        text: value,
      },
    ])

    setInput('')

    const action = findChatAction(value)

    if (action?.run) {
      try {
        const result = await action.run(value)

        setMessages((current) => [
          ...current,
          {
            id: Date.now() + 1,
            role: 'assistant',
            text: result,
          },
        ])

        return
      } catch {
        setMessages((current) => [
          ...current,
          {
            id: Date.now() + 1,
            role: 'assistant',
            text: 'The requested tool action could not be completed.',
          },
        ])

        return
      }
    }

    if (action) {
      const targetApp = APP_REGISTRY.find(
        (app) => app.id === action.appId,
      )

      if (targetApp) {
        savePendingChatCommand({
          id: `${Date.now()}`,
          input: value,
          appId: targetApp.id,
          actionId: action.id,
          createdAt: Date.now(),
        })

        setMessages((current) => [
          ...current,
          {
            id: Date.now() + 1,
            role: 'assistant',
            text: `Opening ${targetApp.name} and passing your request to the tool.`,
          },
        ])

        navigate(targetApp.path)
        return
      }
    }

    const matchedApp = findAppForInput(value)

    if (matchedApp) {
      savePendingChatCommand({
        id: `${Date.now()}`,
        input: value,
        appId: matchedApp.id,
        createdAt: Date.now(),
      })

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: `Opening ${matchedApp.name} and passing your request to the tool.`,
        },
      ])

      navigate(matchedApp.path)
      return
    }

    setMessages((current) => [
      ...current,
      {
        id: Date.now() + 1,
        role: 'assistant',
        text: 'I could not match that request to a connected action yet. As more tool actions are registered, they will become available here automatically.',
      },
    ])
  }

  const chatContent = (
    <section
      className={
        mode === 'dashboard'
          ? 'global-tool-chat-panel global-tool-chat-dashboard'
          : 'global-tool-chat-panel global-tool-chat-floating'
      }
    >
      <header className="global-tool-chat-header">
        <div>
          <strong>1 Hub Assistant</strong>
          <span>Access tools across all apps</span>
        </div>

        {mode === 'floating' && (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
          >
            ×
          </button>
        )}
      </header>

      <div className="global-tool-chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`global-tool-chat-message is-${message.role}`}
          >
            {message.text}
          </div>
        ))}
      </div>

      <form
        className="global-tool-chat-form"
        onSubmit={handleSubmit}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="What do you want to do?"
          aria-label="Ask 1 Hub Assistant"
        />

        <button type="submit">
          Send
        </button>
      </form>
    </section>
  )

  if (mode === 'dashboard') {
    return chatContent
  }

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          className="global-tool-chat-toggle"
          onClick={() => setIsOpen(true)}
          aria-label="Open 1 Hub Assistant"
        >
          💬
        </button>
      )}

      {isOpen && chatContent}
    </>
  )
}

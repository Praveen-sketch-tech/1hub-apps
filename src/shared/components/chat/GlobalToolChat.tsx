import { FormEvent, useState } from 'react'
import { APP_REGISTRY } from '@core/apps/appRegistry'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  findAppForInput,
  findChatAction,
  savePendingChatCommand,
} from '@core/chat/chatRegistry'
import { registerDefaultChatActions } from '@core/chat/defaultChatActions'
import { executeChatRequest } from '@core/chat/chatExecutor'
import { downloadBlob } from '@shared/utils/downloads'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  downloadUrl?: string
  downloadName?: string
  downloadBlob?: Blob
  downloadStatus?: string
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
  const [attachment, setAttachment] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
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

    setIsProcessing(true)

    try {
      const parts = value.split(/(?:\s+(?:and|then|aur|phir)\s+|[,;]+|\s*→\s*)/i).map((part) => part.trim()).filter(Boolean)
      const requests = parts.length > 1 ? parts : [value]
      const results = []
      for (const request of requests) {
        const result = await executeChatRequest(request, attachment ?? undefined)
        if (result) results.push(result)
      }
      const directResult = results.length ? {
        text: results.map((result) => result.text).join('\n\n'),
        blob: results[results.length - 1].blob,
        fileName: results[results.length - 1].fileName,
      } : null

      if (directResult) {
        let downloadUrl: string | undefined

        if (directResult.blob) {
          downloadUrl = URL.createObjectURL(directResult.blob)
        }

        setMessages((current) => [
          ...current,
          {
            id: Date.now() + 1,
            role: 'assistant',
            text: directResult.text,
            downloadUrl,
            downloadName: directResult.fileName,
            downloadBlob: directResult.blob,
          },
        ])

        setAttachment(null)
        return
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text:
            error instanceof Error
              ? error.message
              : 'The requested action could not be completed.',
        },
      ])

      return
    } finally {
      setIsProcessing(false)
    }

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
            <span>{message.text}</span>

            {message.downloadUrl && message.downloadName && (
              <button
                type="button"
                className="global-tool-chat-download"
                onClick={() => {
                  if (!message.downloadUrl || !message.downloadName) return

                  const blob = message.downloadBlob
                  if (blob) {
                    downloadBlob(blob, message.downloadName)
                    setMessages((current) => current.map((item) =>
                      item.id === message.id ? { ...item, downloadStatus: 'Download started ✓' } : item,
                    ))
                  }
                }}
              >
                {message.downloadStatus || 'Download'}
              </button>
            )}
          </div>
        ))}
      </div>

      <form
        className="global-tool-chat-form"
        onSubmit={handleSubmit}
      >
        {attachment && (
          <div className="global-tool-chat-attachment">
            <span>{attachment.name}</span>

            <button
              type="button"
              onClick={() => setAttachment(null)}
            >
              ×
            </button>
          </div>
        )}

        <div className="global-tool-chat-compose">
          <label
            className="global-tool-chat-attach"
            title="Attach file"
          >
            📎
            <input
              type="file"
              onChange={(event) =>
                setAttachment(event.target.files?.[0] ?? null)
              }
            />
          </label>

          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="What do you want to do?"
            aria-label="Ask 1 Hub Assistant"
          />

          <button
            type="submit"
            disabled={isProcessing}
          >
            {isProcessing ? 'Working…' : 'Send'}
          </button>
        </div>
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

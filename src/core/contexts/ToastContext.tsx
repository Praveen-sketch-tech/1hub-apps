import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { ToastMessage } from '@core/types'
import { TOAST_DURATION_MS } from '@core/config/constants'
import { ToastViewport } from '@shared/components/feedback/ToastViewport'

interface ToastContextValue {
  toasts: ToastMessage[]
  showToast: (message: string, type?: ToastMessage['type']) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastMessage['type'] = 'info') => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, message, type }])
      window.setTimeout(() => dismissToast(id), TOAST_DURATION_MS)
    },
    [dismissToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

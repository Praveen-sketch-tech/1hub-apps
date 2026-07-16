import type { ToastMessage } from '@core/types'

const toneClasses: Record<ToastMessage['type'], string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-amber-600',
  info: 'bg-slate-800'
}

export function ToastViewport({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${toneClasses[toast.type]}`}
        >
          <span>{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} className="text-white/80 hover:text-white" aria-label="Dismiss">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

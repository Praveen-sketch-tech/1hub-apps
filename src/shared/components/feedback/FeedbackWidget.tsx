import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { Modal } from '@shared/components/ui/Modal'
import { useAuth } from '@core/contexts/AuthContext'
import { useToast } from '@core/contexts/ToastContext'
import { submitFeedback } from '@core/supabase/queries/feedback'
import { trackFeature } from '@core/hooks/useAnalytics'
import type { FeedbackType } from '@core/types'

const OPTIONS: { type: FeedbackType; label: string }[] = [
  { type: 'useful', label: '👍 Useful' },
  { type: 'not_useful', label: '👎 Not useful' },
  { type: 'bug_report', label: '🐛 Report a bug' },
  { type: 'suggestion', label: '💡 Suggest next tool' }
]

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()

  async function handleSubmit(type: FeedbackType, text?: string) {
    setSubmitting(true)
    const { error } = await submitFeedback({
      user_id: user?.id ?? null,
      type,
      message: text ?? null,
      page: location.pathname
    })
    setSubmitting(false)
    if (error) {
      showToast('Could not submit feedback. Please try again.', 'error')
      return
    }
    trackFeature('feedback_submitted', { type })
    showToast('Thanks for your feedback!', 'success')
    setMessage('')
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-700"
      >
        Feedback
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Share your feedback">
        <div className="flex flex-wrap gap-2">
          {OPTIONS.map((opt) => (
            <Button key={opt.type} variant="secondary" onClick={() => handleSubmit(opt.type)} disabled={submitting}>
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us more (optional)"
            rows={3}
            className="rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
          />
          <Button onClick={() => handleSubmit('text', message)} disabled={!message.trim() || submitting} loading={submitting}>
            Send
          </Button>
        </div>
      </Modal>
    </>
  )
}

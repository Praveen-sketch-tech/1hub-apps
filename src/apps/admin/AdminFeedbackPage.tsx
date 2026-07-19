import { useEffect, useState } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Badge } from '@shared/components/ui/Badge'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { getAllFeedback } from '@core/supabase/queries/feedback'
import { formatDateTime } from '@core/utils/formatters'
import type { FeedbackRow, FeedbackType } from '@core/types'

const toneByType: Record<FeedbackType, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  useful: 'success',
  not_useful: 'danger',
  bug_report: 'warning',
  suggestion: 'info',
  text: 'default'
}

export function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllFeedback().then(({ data }) => {
      setFeedback(data ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Feedback</h1>
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : feedback.length === 0 ? (
        <EmptyState title="No feedback yet" />
      ) : (
        <div className="flex flex-col gap-3">
          {feedback.map((item) => (
            <Card key={item.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Badge tone={toneByType[item.type]}>{item.type.replace('_', ' ')}</Badge>
                <span className="text-xs text-slate-500">{formatDateTime(item.created_at)}</span>
              </div>
              {item.message && <p className="text-sm">{item.message}</p>}
              {item.page && <p className="text-xs text-slate-500">Page: {item.page}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

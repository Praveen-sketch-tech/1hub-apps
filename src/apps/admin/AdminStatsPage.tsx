import { useEffect, useMemo, useState } from 'react'
import { Card } from '@shared/components/ui/Card'
import { getRecentEvents } from '@core/supabase/queries/analytics'
import type { AnalyticsEventRow } from '@core/types'

export function AdminStatsPage() {
  const [events, setEvents] = useState<AnalyticsEventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRecentEvents(500).then(({ data }) => {
      setEvents(data ?? [])
      setLoading(false)
    })
  }, [])

  const counts = useMemo(() => {
    const byType: Record<string, number> = {}
    for (const event of events) {
      byType[event.event_type] = (byType[event.event_type] ?? 0) + 1
    }
    return byType
  }, [events])

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">App Statistics</h1>
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(counts).length === 0 && <p className="text-sm text-slate-500">No data yet.</p>}
          {Object.entries(counts).map(([type, count]) => (
            <Card key={type}>
              <p className="text-sm capitalize text-slate-500">{type.replace('_', ' ')}</p>
              <p className="mt-1 text-2xl font-semibold">{count}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

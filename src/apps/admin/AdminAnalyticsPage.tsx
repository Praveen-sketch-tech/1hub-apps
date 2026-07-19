import { useEffect, useMemo, useState } from 'react'
import { Card } from '@shared/components/ui/Card'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { getRecentSessions, getRecentEvents } from '@core/supabase/queries/analytics'
import { formatDateTime, formatDuration } from '@core/utils/formatters'
import type { AnalyticsSessionRow, AnalyticsEventRow } from '@core/types'

export function AdminAnalyticsPage() {
  const [sessions, setSessions] = useState<AnalyticsSessionRow[]>([])
  const [events, setEvents] = useState<AnalyticsEventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [sessionsRes, eventsRes] = await Promise.all([getRecentSessions(50), getRecentEvents(200)])
      setSessions(sessionsRes.data ?? [])
      setEvents(eventsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Sessions are immutable (see supabase/policies.sql) — duration is
  // recorded as a separate `session_end` event rather than an UPDATE on the
  // session row, so we look it up here instead of reading
  // session.duration_seconds directly.
  const durationBySession = useMemo(() => {
    const map = new Map<string, number>()
    for (const event of events) {
      if (event.event_type === 'session_end' && event.session_id) {
        const duration = (event.metadata as { duration_seconds?: number } | null)?.duration_seconds
        if (typeof duration === 'number') map.set(event.session_id, duration)
      }
    }
    return map
  }, [events])

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Analytics</h1>

      <section>
        <h2 className="mb-3 text-base font-semibold">Recent sessions</h2>
        {sessions.length === 0 ? (
          <EmptyState title="No sessions recorded yet" />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="p-3">Started</th>
                  <th className="p-3">Device</th>
                  <th className="p-3">Browser</th>
                  <th className="p-3">Returning</th>
                  <th className="p-3">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sessions.map((s) => {
                  const duration = durationBySession.get(s.id)
                  return (
                    <tr key={s.id}>
                      <td className="p-3">{formatDateTime(s.started_at)}</td>
                      <td className="p-3">{s.device ?? '—'}</td>
                      <td className="p-3">{s.browser ?? '—'}</td>
                      <td className="p-3">{s.is_returning ? 'Yes' : 'No'}</td>
                      <td className="p-3">{duration != null ? formatDuration(duration) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Recent events</h2>
        {events.length === 0 ? (
          <EmptyState title="No events recorded yet" />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Path / Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {events.slice(0, 50).map((e) => (
                  <tr key={e.id}>
                    <td className="p-3">{formatDateTime(e.created_at)}</td>
                    <td className="p-3">{e.event_type}</td>
                    <td className="p-3">{e.path ?? e.label ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  )
}

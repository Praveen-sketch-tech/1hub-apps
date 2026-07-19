import { useEffect, useState } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Badge } from '@shared/components/ui/Badge'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { getLogs } from '@core/supabase/queries/admin'
import { formatDateTime } from '@core/utils/formatters'
import type { LogRow } from '@core/types'

const toneByLevel: Record<LogRow['level'], 'info' | 'warning' | 'danger'> = {
  info: 'info',
  warning: 'warning',
  error: 'danger'
}

export function AdminLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLogs().then(({ data }) => {
      setLogs(data ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Logs</h1>
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : logs.length === 0 ? (
        <EmptyState title="No logs recorded yet" description="System and error logs will appear here." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Level</th>
                <th className="p-3">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="p-3">{formatDateTime(log.created_at)}</td>
                  <td className="p-3">
                    <Badge tone={toneByLevel[log.level]}>{log.level}</Badge>
                  </td>
                  <td className="p-3">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

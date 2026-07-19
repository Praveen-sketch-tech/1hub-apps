import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@shared/components/ui/Card'
import { getAllUsers } from '@core/supabase/queries/admin'
import { getRecentSessions } from '@core/supabase/queries/analytics'
import { getAllFeedback } from '@core/supabase/queries/feedback'
import { ROUTES } from '@core/config/constants'

interface Stats {
  users: number
  sessions: number
  feedback: number
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    async function load() {
      const [users, sessions, feedback] = await Promise.all([
        getAllUsers(1000),
        getRecentSessions(1000),
        getAllFeedback(1000)
      ])
      setStats({
        users: users.data?.length ?? 0,
        sessions: sessions.data?.length ?? 0,
        feedback: feedback.data?.length ?? 0
      })
    }
    load()
  }, [])

  const cards = [
    { label: 'Total users', value: stats?.users, to: ROUTES.adminUsers },
    { label: 'Recorded sessions', value: stats?.sessions, to: ROUTES.adminAnalytics },
    { label: 'Feedback received', value: stats?.feedback, to: ROUTES.adminFeedback }
  ]

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Admin Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} to={card.to}>
            <Card>
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold">{card.value ?? '—'}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

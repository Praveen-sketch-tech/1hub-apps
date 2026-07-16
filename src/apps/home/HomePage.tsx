import { Link } from 'react-router-dom'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { useAuth } from '@core/contexts/AuthContext'
import { ROUTES, APP_NAME } from '@core/config/constants'

const FEATURES = [
  { title: 'Authentication', description: 'Login, signup, password reset, and session handling out of the box.' },
  { title: 'Profiles', description: 'Name, email, mobile, avatar, and password management.' },
  { title: 'Self-hosted analytics', description: 'Visitors, sessions, devices, and feature usage — stored in Supabase.' },
  { title: 'Admin panel', description: 'Users, analytics, feedback, logs, and app settings in one place.' }
]

export function HomePage() {
  const { user } = useAuth()

  return (
    <PageContainer>
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">{APP_NAME}</h1>
        <p className="max-w-xl text-slate-600 dark:text-slate-400">
          A production-ready starter platform — the base every future app is built on top of.
        </p>
        {!user && (
          <div className="flex gap-3">
            <Link to={ROUTES.signup}>
              <Button>Get started</Button>
            </Link>
            <Link to={ROUTES.login}>
              <Button variant="secondary">Log in</Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <h2 className="mb-1 text-base font-semibold">{feature.title}</h2>
            <p className="text-sm text-slate-500">{feature.description}</p>
          </Card>
        ))}
      </div>
    </PageContainer>
  )
}

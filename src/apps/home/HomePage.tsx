import { Link } from 'react-router-dom'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { useAuth } from '@core/contexts/AuthContext'
import { ROUTES, APP_NAME } from '@core/config/constants'
import { APP_REGISTRY } from '@core/apps/appRegistry'

const FEATURES = [
  {
    title: 'Authentication',
    description:
      'Login, signup, password reset, and session handling out of the box.'
  },
  {
    title: 'Profiles',
    description:
      'Name, email, mobile, avatar, and password management.'
  },
  {
    title: 'Self-hosted analytics',
    description:
      'Visitors, sessions, devices, and feature usage — stored in Supabase.'
  },
  {
    title: 'Admin panel',
    description:
      'Users, analytics, feedback, logs, and app settings in one place.'
  }
]

export function HomePage() {
  const { user } = useAuth()

  return (
    <PageContainer>
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">{APP_NAME}</h1>

        <p className="max-w-xl text-slate-600 dark:text-slate-400">
          Useful, fast and privacy-friendly web tools built for everyday work.
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

      <section className="mb-12">
        <div className="grid gap-4 sm:grid-cols-2">
          {APP_REGISTRY.map((app) => (
            <Card key={app.id}>
              <div className="flex h-full flex-col gap-5">
                <div>
                  <p className="mb-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                    App #{app.number}
                  </p>

                  <h2 className="text-xl font-bold">{app.name}</h2>

                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {app.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                    {app.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-2">
                  <Link to={app.path}>
                    <Button>Open tool</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Platform features</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <h3 className="mb-1 text-base font-semibold">
                {feature.title}
              </h3>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </PageContainer>
  )
}

import { Link } from 'react-router-dom'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { useAuth } from '@core/contexts/AuthContext'
import { ROUTES, APP_NAME } from '@core/config/constants'

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
        <div className="mb-5">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            App #001
          </p>

          <h2 className="text-2xl font-bold">Smart Image Tools</h2>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Compress, resize, convert and crop images directly in your browser.
          </p>
        </div>

        <Card>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Smart Image Tools</h3>

              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Your images stay on your device. No upload to a server, no paid
                API and no login required.
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                  Compress
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                  Resize
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                  Convert
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                  Crop
                </span>
              </div>
            </div>

            <Link to={ROUTES.smartImageTools}>
              <Button>Open tool</Button>
            </Link>
          </div>
        </Card>
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

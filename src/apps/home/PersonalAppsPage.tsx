import { Link } from 'react-router-dom'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { APP_REGISTRY } from '@core/apps/appRegistry'

export function PersonalAppsPage() {
  return (
    <PageContainer>
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Personal Tools</h1>
        <p className="max-w-xl text-slate-600 dark:text-slate-400">
          All apps built so far — for personal use.
        </p>
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
                      <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
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
    </PageContainer>
  )
}

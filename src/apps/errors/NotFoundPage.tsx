import { Link } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { ROUTES } from '@core/config/constants'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-6xl font-bold text-slate-300 dark:text-slate-700">404</span>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-slate-500">The page you're looking for doesn't exist or has moved.</p>
      <Link to={ROUTES.home}>
        <Button>Go home</Button>
      </Link>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { ROUTES } from '@core/config/constants'

export function ServerErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-6xl font-bold text-slate-300 dark:text-slate-700">500</span>
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-slate-500">An unexpected error occurred. Please try again.</p>
      <Link to={ROUTES.home}>
        <Button>Go home</Button>
      </Link>
    </div>
  )
}

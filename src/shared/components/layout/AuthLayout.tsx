import { Outlet, Link } from 'react-router-dom'
import { APP_NAME, ROUTES } from '@core/config/constants'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <Link to={ROUTES.home} className="mb-8 text-xl font-semibold">
        {APP_NAME}
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Outlet />
      </div>
    </div>
  )
}

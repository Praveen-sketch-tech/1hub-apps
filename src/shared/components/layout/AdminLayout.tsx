import { NavLink, Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { ROUTES } from '@core/config/constants'

const links = [
  { to: ROUTES.admin, label: 'Dashboard', end: true },
  { to: ROUTES.adminUsers, label: 'Users' },
  { to: ROUTES.adminAnalytics, label: 'Analytics' },
  { to: ROUTES.adminFeedback, label: 'Feedback' },
  { to: ROUTES.adminLogs, label: 'Logs' },
  { to: ROUTES.adminSettings, label: 'Settings' },
  { to: ROUTES.adminStats, label: 'App Statistics' }
]

export function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        <aside className="hidden w-48 shrink-0 sm:block">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

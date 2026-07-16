import { Link } from 'react-router-dom'
import { ROUTES } from '@core/config/constants'

export function Footer() {
  return (
    <footer className="border-t border-slate-200 py-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
        <span>© {new Date().getFullYear()} Hub Apps</span>
        <div className="flex gap-4">
          <Link to={ROUTES.privacy} className="hover:text-slate-900 dark:hover:text-white">Privacy</Link>
          <Link to={ROUTES.terms} className="hover:text-slate-900 dark:hover:text-white">Terms</Link>
          <Link to={ROUTES.about} className="hover:text-slate-900 dark:hover:text-white">About</Link>
          <Link to={ROUTES.contact} className="hover:text-slate-900 dark:hover:text-white">Contact</Link>
        </div>
      </div>
    </footer>
  )
}

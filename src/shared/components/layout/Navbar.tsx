import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@core/contexts/AuthContext'
import { useTheme } from '@core/contexts/ThemeContext'
import { Avatar } from '@shared/components/ui/Avatar'
import { Button } from '@shared/components/ui/Button'
import { signOut } from '@core/supabase/queries/auth'
import { ROUTES } from '@core/config/constants'
import { APP_NAME } from '@core/config/constants'

export function Navbar() {
  const { user, profile, isAdmin } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate(ROUTES.login)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to={ROUTES.home} className="text-base font-semibold">
          {APP_NAME}
        </Link>

        <nav className="flex items-center gap-3">
          <Link to={ROUTES.search} className="hidden text-sm text-slate-600 hover:text-slate-900 sm:inline dark:text-slate-400 dark:hover:text-white">
            Search
          </Link>
          {isAdmin && (
            <Link to={ROUTES.admin} className="hidden text-sm text-slate-600 hover:text-slate-900 sm:inline dark:text-slate-400 dark:hover:text-white">
              Admin
            </Link>
          )}

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-lg p-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <Link to={ROUTES.profile}>
                <Avatar src={profile?.avatar_url} name={profile?.full_name} size={32} />
              </Link>
              <Button variant="ghost" onClick={handleLogout}>
                Log out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to={ROUTES.login}>
                <Button variant="ghost">Log in</Button>
              </Link>
              <Link to={ROUTES.signup}>
                <Button>Sign up</Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}

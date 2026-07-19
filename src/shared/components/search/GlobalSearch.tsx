import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@core/contexts/AuthContext'
import { ROUTES } from '@core/config/constants'

interface SearchItem {
  label: string
  path: string
  keywords?: string
  adminOnly?: boolean
}

// Static, extensible search index. Feature modules can register more
// entries here as the platform grows — no external search service needed yet.
//
// Admin-only entries are filtered out for non-admin users below. `isAdmin`
// comes from AuthContext, which reads the `role` column on the user's own
// `profiles` row through RLS — the same server-backed source of truth used
// by AdminRoute — so this can't be spoofed from the client.
const SEARCH_INDEX: SearchItem[] = [
  { label: 'Home', path: ROUTES.home },
  { label: 'Profile', path: ROUTES.profile },
  { label: 'Settings', path: ROUTES.settings },
  { label: 'Admin Dashboard', path: ROUTES.admin, keywords: 'admin dashboard', adminOnly: true },
  { label: 'Admin — Users', path: ROUTES.adminUsers, adminOnly: true },
  { label: 'Admin — Analytics', path: ROUTES.adminAnalytics, adminOnly: true },
  { label: 'Admin — Feedback', path: ROUTES.adminFeedback, adminOnly: true },
  { label: 'Admin — Logs', path: ROUTES.adminLogs, adminOnly: true },
  { label: 'Admin — App Settings', path: ROUTES.adminSettings, adminOnly: true },
  { label: 'Admin — Statistics', path: ROUTES.adminStats, adminOnly: true },
  { label: 'Privacy Policy', path: ROUTES.privacy },
  { label: 'Terms of Service', path: ROUTES.terms },
  { label: 'About', path: ROUTES.about },
  { label: 'Contact', path: ROUTES.contact }
]

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return SEARCH_INDEX.filter((item) => !item.adminOnly || isAdmin).filter(
      (item) => item.label.toLowerCase().includes(q) || item.keywords?.toLowerCase().includes(q)
    )
  }, [query, isAdmin])

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search pages, tools, and settings…"
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
      />
      {results.length > 0 && (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {results.map((item) => (
            <li key={item.path}>
              <button
                onClick={() => navigate(item.path)}
                className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query && results.length === 0 && <p className="text-sm text-slate-500">No results for “{query}”.</p>}
    </div>
  )
}

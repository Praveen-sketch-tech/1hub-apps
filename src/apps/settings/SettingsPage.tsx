import { useState } from 'react'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { useTheme } from '@core/contexts/ThemeContext'
import { useToast } from '@core/contexts/ToastContext'

interface NotificationPrefs {
  email: boolean
  push: boolean
  productUpdates: boolean
}

// Language is future-ready: only English is available today, but the
// selector and the shape of the setting are already in place.
const LANGUAGES = [{ code: 'en', label: 'English' }]

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { showToast } = useToast()
  const [prefs, setPrefs] = useState<NotificationPrefs>({ email: true, push: false, productUpdates: true })
  const [language, setLanguage] = useState('en')

  function togglePref(key: keyof NotificationPrefs) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSave() {
    // Placeholder: persist to app_settings / a user_settings table once needed.
    showToast('Settings saved.', 'success')
  }

  return (
    <PageContainer className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold">Settings</h1>

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold">Appearance</h2>
        <div className="flex gap-2">
          <Button variant={theme === 'light' ? 'primary' : 'secondary'} onClick={() => setTheme('light')}>
            Light
          </Button>
          <Button variant={theme === 'dark' ? 'primary' : 'secondary'} onClick={() => setTheme('dark')}>
            Dark
          </Button>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold">Notification preferences</h2>
        <div className="flex flex-col gap-3 text-sm">
          {(
            [
              ['email', 'Email notifications'],
              ['push', 'Push notifications'],
              ['productUpdates', 'Product updates']
            ] as [keyof NotificationPrefs, string][]
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between">
              <span>{label}</span>
              <input type="checkbox" checked={prefs[key]} onChange={() => togglePref(key)} className="h-4 w-4" />
            </label>
          ))}
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold">Language</h2>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-slate-500">More languages coming soon.</p>
      </Card>

      <Button onClick={handleSave}>Save settings</Button>
    </PageContainer>
  )
}

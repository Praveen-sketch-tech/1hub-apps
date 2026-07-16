import { FormEvent, useEffect, useState } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Input } from '@shared/components/ui/Input'
import { Button } from '@shared/components/ui/Button'
import { getSetting, upsertSetting } from '@core/supabase/queries/admin'
import { useToast } from '@core/contexts/ToastContext'

const SETTINGS_KEY = 'app_general'

interface GeneralSettings {
  maintenanceMode: boolean
  supportEmail: string
}

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<GeneralSettings>({ maintenanceMode: false, supportEmail: '' })
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    getSetting(SETTINGS_KEY).then(({ data }) => {
      if (data?.value) setSettings(data.value as unknown as GeneralSettings)
    })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await upsertSetting(SETTINGS_KEY, settings as unknown as Record<string, unknown>)
    setSaving(false)
    if (error) {
      showToast('Could not save settings.', 'error')
      return
    }
    showToast('App settings saved.', 'success')
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">App Settings</h1>
      <Card className="max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex items-center justify-between text-sm">
            <span>Maintenance mode</span>
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings((s) => ({ ...s, maintenanceMode: e.target.checked }))}
              className="h-4 w-4"
            />
          </label>
          <Input
            label="Support email"
            type="email"
            value={settings.supportEmail}
            onChange={(e) => setSettings((s) => ({ ...s, supportEmail: e.target.value }))}
          />
          <Button type="submit" loading={saving} className="w-fit">
            Save
          </Button>
        </form>
      </Card>
    </div>
  )
}

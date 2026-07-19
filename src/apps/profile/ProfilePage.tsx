import { FormEvent, useState } from 'react'
import { useAuth } from '@core/contexts/AuthContext'
import { useToast } from '@core/contexts/ToastContext'
import { updateProfile, uploadAvatar } from '@core/supabase/queries/profile'
import { Card } from '@shared/components/ui/Card'
import { Input } from '@shared/components/ui/Input'
import { Button } from '@shared/components/ui/Button'
import { Avatar } from '@shared/components/ui/Avatar'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { isValidMobile } from '@core/utils/validators'
import { ChangePasswordCard } from './ChangePasswordCard'

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [mobile, setMobile] = useState(profile?.mobile ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (mobile && !isValidMobile(mobile)) {
      showToast('Please enter a valid mobile number.', 'warning')
      return
    }
    setSaving(true)
    try {
      await updateProfile(user.id, { full_name: fullName, mobile })
      await refreshProfile()
      showToast('Profile updated.', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update profile.'
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(file: File) {
    if (!user) return
    setUploading(true)
    try {
      const url = await uploadAvatar(user.id, file)
      await updateProfile(user.id, { avatar_url: url })
      await refreshProfile()
      showToast('Avatar updated.', 'success')
    } catch (err) {
      showToast('Could not upload avatar.', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <PageContainer className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold">Profile</h1>

      <Card className="mb-6 flex items-center gap-4">
        <Avatar src={profile?.avatar_url} name={profile?.full_name} size={64} />
        <div>
          <label className="cursor-pointer text-sm text-brand-600 hover:underline">
            {uploading ? 'Uploading…' : 'Change avatar'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleAvatarChange(file)
              }}
            />
          </label>
        </div>
      </Card>

      <Card className="mb-6">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Email" value={user?.email ?? ''} disabled />
          <Input label="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+1 555 000 0000" />
          <Button type="submit" loading={saving} className="w-fit">
            Save changes
          </Button>
        </form>
      </Card>

      <ChangePasswordCard />
    </PageContainer>
  )
}

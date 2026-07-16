import { FormEvent, useState } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Input } from '@shared/components/ui/Input'
import { Button } from '@shared/components/ui/Button'
import { updatePassword } from '@core/supabase/queries/auth'
import { useToast } from '@core/contexts/ToastContext'
import { isStrongPassword } from '@core/utils/validators'

export function ChangePasswordCard() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isStrongPassword(password)) {
      showToast('Password must be at least 8 characters and include a number.', 'warning')
      return
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'warning')
      return
    }
    setSaving(true)
    const { error } = await updatePassword(password)
    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    setPassword('')
    setConfirmPassword('')
    showToast('Password changed.', 'success')
  }

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold">Change password</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" loading={saving} className="w-fit">
          Update password
        </Button>
      </form>
    </Card>
  )
}

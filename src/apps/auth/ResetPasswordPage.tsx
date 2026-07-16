import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@shared/components/ui/Input'
import { Button } from '@shared/components/ui/Button'
import { updatePassword } from '@core/supabase/queries/auth'
import { useToast } from '@core/contexts/ToastContext'
import { isStrongPassword } from '@core/utils/validators'
import { ROUTES } from '@core/config/constants'

// Supabase redirects here with a recovery token already exchanged for a
// session (see detectSessionInUrl in the client config).
export function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
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
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast('Password updated. Please log in again.', 'success')
    navigate(ROUTES.login)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Reset your password</h1>
      <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <Input
        label="Confirm new password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />
      <Button type="submit" loading={loading} className="w-full">
        Update password
      </Button>
    </form>
  )
}

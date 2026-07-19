import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '@shared/components/ui/Input'
import { Button } from '@shared/components/ui/Button'
import { sendPasswordReset } from '@core/supabase/queries/auth'
import { useToast } from '@core/contexts/ToastContext'
import { isValidEmail } from '@core/utils/validators'
import { ROUTES } from '@core/config/constants'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { showToast } = useToast()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) {
      showToast('Please enter a valid email address.', 'warning')
      return
    }
    setLoading(true)
    const { error } = await sendPasswordReset(email)
    setLoading(false)
    if (error) {
      if (error.message.toLowerCase().includes('rate limit')) {
        showToast(
          "You've requested too many reset emails recently. Supabase limits this on free projects — please wait a while and try again.",
          'warning'
        )
        return
      }
      showToast(error.message, 'error')
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="text-sm text-slate-500">We sent a password reset link to {email}.</p>
        <Link to={ROUTES.login} className="text-sm text-brand-600 hover:underline">
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Forgot password</h1>
      <p className="text-sm text-slate-500">Enter your email and we&apos;ll send you a reset link.</p>
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Button type="submit" loading={loading} className="w-full">
        Send reset link
      </Button>
      <Link to={ROUTES.login} className="text-center text-sm text-brand-600 hover:underline">
        Back to login
      </Link>
    </form>
  )
}

import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Input } from '@shared/components/ui/Input'
import { Button } from '@shared/components/ui/Button'
import { signIn } from '@core/supabase/queries/auth'
import { useToast } from '@core/contexts/ToastContext'
import { isValidEmail } from '@core/utils/validators'
import { ROUTES } from '@core/config/constants'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) {
      showToast('Please enter a valid email address.', 'warning')
      return
    }
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast('Welcome back!', 'success')
    navigate(ROUTES.home)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Log in</h1>
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <div className="flex justify-end">
        <Link to={ROUTES.forgotPassword} className="text-sm text-brand-600 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" loading={loading} className="w-full">
        Log in
      </Button>
      <p className="text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link to={ROUTES.signup} className="text-brand-600 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  )
}

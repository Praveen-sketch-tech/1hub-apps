import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Input } from '@shared/components/ui/Input'
import { Button } from '@shared/components/ui/Button'
import { signUp } from '@core/supabase/queries/auth'
import { useToast } from '@core/contexts/ToastContext'
import { isValidEmail, isStrongPassword } from '@core/utils/validators'
import { ROUTES } from '@core/config/constants'

export function SignupPage() {
  const [fullName, setFullName] = useState('')
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
    if (!isStrongPassword(password)) {
      showToast('Password must be at least 8 characters and include a number.', 'warning')
      return
    }
    setLoading(true)
    const { error } = await signUp(email, password, fullName)
    setLoading(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast('Account created! Check your email to confirm, then log in.', 'success')
    navigate(ROUTES.login)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Create your account</h1>
      <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <Button type="submit" loading={loading} className="w-full">
        Sign up
      </Button>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to={ROUTES.login} className="text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  )
}

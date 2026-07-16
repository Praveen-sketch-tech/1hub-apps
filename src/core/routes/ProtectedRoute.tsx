import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@core/contexts/AuthContext'
import { Spinner } from '@shared/components/ui/Spinner'
import { ROUTES } from '@core/config/constants'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!user) return <Navigate to={ROUTES.login} replace />

  return <Outlet />
}

import { Outlet, useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { FeedbackWidget } from '@shared/components/feedback/FeedbackWidget'
import { useAnalytics } from '@core/hooks/useAnalytics'
import { GlobalToolChat } from '@shared/components/chat/GlobalToolChat'
import { ROUTES } from '@core/config/constants'

export function AppLayout() {
  useAnalytics()
  const location = useLocation()
  const isHome = location.pathname === ROUTES.home

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <Outlet />
      <Footer />
      <FeedbackWidget />
      {!isHome && <GlobalToolChat mode="floating" />}
    </div>
  )
}

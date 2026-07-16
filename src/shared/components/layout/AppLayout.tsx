import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { FeedbackWidget } from '@shared/components/feedback/FeedbackWidget'
import { useAnalytics } from '@core/hooks/useAnalytics'

export function AppLayout() {
  useAnalytics()

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <Outlet />
      <Footer />
      <FeedbackWidget />
    </div>
  )
}

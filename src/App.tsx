import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@core/contexts/AuthContext'
import { ThemeProvider } from '@core/contexts/ThemeContext'
import { ToastProvider } from '@core/contexts/ToastContext'
import { ErrorBoundary } from '@shared/components/ErrorBoundary'
import { AppRoutes } from '@core/routes/AppRoutes'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

import { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@shared/components/layout/AppLayout'
import { AuthLayout } from '@shared/components/layout/AuthLayout'
import { AdminLayout } from '@shared/components/layout/AdminLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { AdminRoute } from './AdminRoute'
import { ROUTES } from '@core/config/constants'
import { APP_LOADERS } from '@core/apps/appLoaders'

import { HomePage } from '@apps/home/HomePage'
import { SearchPage } from '@apps/home/SearchPage'
import { LoginPage } from '@apps/auth/LoginPage'
import { SignupPage } from '@apps/auth/SignupPage'
import { ForgotPasswordPage } from '@apps/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@apps/auth/ResetPasswordPage'
import { ProfilePage } from '@apps/profile/ProfilePage'
import { SettingsPage } from '@apps/settings/SettingsPage'
import { PrivacyPolicyPage, TermsPage, AboutPage, ContactPage } from '@apps/legal/LegalPage'
import { NotFoundPage } from '@apps/errors/NotFoundPage'
import { ServerErrorPage } from '@apps/errors/ServerErrorPage'
import { MaintenancePage } from '@apps/errors/MaintenancePage'
import { OfflinePage } from '@apps/errors/OfflinePage'
import { AdminDashboardPage } from '@apps/admin/AdminDashboardPage'
import { AdminUsersPage } from '@apps/admin/AdminUsersPage'
import { AdminAnalyticsPage } from '@apps/admin/AdminAnalyticsPage'
import { AdminFeedbackPage } from '@apps/admin/AdminFeedbackPage'
import { AdminLogsPage } from '@apps/admin/AdminLogsPage'
import { AdminSettingsPage } from '@apps/admin/AdminSettingsPage'
import { AdminStatsPage } from '@apps/admin/AdminStatsPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* Public + authenticated app shell */}
      <Route element={<AppLayout />}>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path={ROUTES.search} element={<SearchPage />} />
        {APP_LOADERS.map((app) => {
          const AppComponent = app.component

          return (
            <Route
              key={app.path}
              path={app.path}
              element={
                <Suspense
                  fallback={
                    <div className="p-8 text-center">
                      Loading {app.name}…
                    </div>
                  }
                >
                  <AppComponent />
                </Suspense>
              }
            />
          )
        })}
        <Route path={ROUTES.privacy} element={<PrivacyPolicyPage />} />
        <Route path={ROUTES.terms} element={<TermsPage />} />
        <Route path={ROUTES.about} element={<AboutPage />} />
        <Route path={ROUTES.contact} element={<ContactPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.profile} element={<ProfilePage />} />
          <Route path={ROUTES.settings} element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Auth pages (no navbar/footer) */}
      <Route element={<AuthLayout />}>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.signup} element={<SignupPage />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />
      </Route>

      {/* Admin panel */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path={ROUTES.admin} element={<AdminDashboardPage />} />
          <Route path={ROUTES.adminUsers} element={<AdminUsersPage />} />
          <Route path={ROUTES.adminAnalytics} element={<AdminAnalyticsPage />} />
          <Route path={ROUTES.adminFeedback} element={<AdminFeedbackPage />} />
          <Route path={ROUTES.adminLogs} element={<AdminLogsPage />} />
          <Route path={ROUTES.adminSettings} element={<AdminSettingsPage />} />
          <Route path={ROUTES.adminStats} element={<AdminStatsPage />} />
        </Route>
      </Route>

      {/* Error / status pages */}
      <Route path={ROUTES.maintenance} element={<MaintenancePage />} />
      <Route path={ROUTES.offline} element={<OfflinePage />} />
      <Route path="/500" element={<ServerErrorPage />} />
      <Route path={ROUTES.notFound} element={<NotFoundPage />} />
    </Routes>
  )
}

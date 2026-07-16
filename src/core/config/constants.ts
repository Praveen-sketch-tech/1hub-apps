export const APP_NAME = 'Hub Apps'

export const ROUTES = {
  home: '/',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  profile: '/profile',
  settings: '/settings',
  search: '/search',
  privacy: '/legal/privacy',
  terms: '/legal/terms',
  about: '/about',
  contact: '/contact',
  admin: '/admin',
  adminUsers: '/admin/users',
  adminAnalytics: '/admin/analytics',
  adminFeedback: '/admin/feedback',
  adminLogs: '/admin/logs',
  adminSettings: '/admin/settings',
  adminStats: '/admin/stats',
  maintenance: '/maintenance',
  offline: '/offline',
  notFound: '*'
} as const

export const FEEDBACK_TYPES = ['useful', 'not_useful', 'bug_report', 'suggestion', 'text'] as const

export const TOAST_DURATION_MS = 4000

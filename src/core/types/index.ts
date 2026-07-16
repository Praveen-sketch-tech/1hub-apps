export type {
  ProfileRow,
  UserRole,
  FeedbackRow,
  FeedbackType,
  AnalyticsEventRow,
  AnalyticsSessionRow,
  LogRow,
  AppSettingRow
} from '@core/supabase/types'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

export type Theme = 'light' | 'dark'

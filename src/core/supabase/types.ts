// Hand-written types mirroring the Supabase schema (see /supabase/schema.sql).
// Once the project is linked to a real Supabase instance, these can be
// regenerated with: `supabase gen types typescript --linked`.
//
// IMPORTANT: supabase-js's generic `SupabaseClient<Database>` expects each
// schema to expose Tables / Views / Functions / Enums / CompositeTypes, and
// each table to expose Row / Insert / Update / Relationships. Leaving any of
// these out is the #1 cause of every query silently resolving to `never` —
// that's what happened in the previous version of this file.

export type UserRole = 'user' | 'admin'

export interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  mobile: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface AnalyticsSessionRow {
  id: string
  user_id: string | null
  device: string | null
  browser: string | null
  os: string | null
  country: string | null
  is_returning: boolean
  started_at: string
  // Sessions are append-only / immutable (see policies.sql). ended_at and
  // duration_seconds are kept for schema compatibility but are no longer
  // written to directly — session end/duration is recorded as a
  // `session_end` analytics_event instead, so no RLS UPDATE policy is
  // required on this table.
  ended_at: string | null
  duration_seconds: number | null
}

export type AnalyticsEventType = 'page_view' | 'feature_usage' | 'error' | 'feedback_submitted' | 'session_end'

export interface AnalyticsEventRow {
  id: string
  session_id: string | null
  user_id: string | null
  event_type: AnalyticsEventType
  path: string | null
  label: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type FeedbackType = 'useful' | 'not_useful' | 'bug_report' | 'suggestion' | 'text'

export interface FeedbackRow {
  id: string
  user_id: string | null
  type: FeedbackType
  message: string | null
  page: string | null
  created_at: string
}

export interface LogRow {
  id: string
  user_id: string | null
  level: 'info' | 'warning' | 'error'
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AppSettingRow {
  key: string
  value: Record<string, unknown>
  updated_at: string
}

type TableDef<Row, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, Partial<ProfileRow> & { id: string }, Partial<ProfileRow>>
      analytics_sessions: TableDef<AnalyticsSessionRow, Partial<AnalyticsSessionRow>>
      analytics_events: TableDef<AnalyticsEventRow, Partial<AnalyticsEventRow>>
      feedback: TableDef<FeedbackRow, Partial<FeedbackRow>>
      logs: TableDef<LogRow, Partial<LogRow>>
      app_settings: TableDef<AppSettingRow, Partial<AppSettingRow> & { key: string }, Partial<AppSettingRow>>
    }
    Views: Record<string, never>
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

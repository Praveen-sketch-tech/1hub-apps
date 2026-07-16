import { supabase } from '../client'
import type { AnalyticsEventRow, AnalyticsSessionRow } from '../types'

// Analytics sessions are append-only / immutable — there is deliberately no
// UPDATE policy on analytics_sessions (an earlier version of this file had
// `using (true)` on UPDATE, which let any client rewrite any session's row;
// that policy has been removed). To record how long a session lasted, we
// insert a `session_end` event instead of mutating the session row — see
// endSession() below.

export async function createSession(session: Partial<AnalyticsSessionRow>) {
  return supabase.from('analytics_sessions').insert(session).select().single()
}

export async function endSession(sessionId: string, userId: string | null, durationSeconds: number) {
  return logEvent({
    session_id: sessionId,
    user_id: userId,
    event_type: 'session_end',
    metadata: { duration_seconds: durationSeconds }
  })
}

export async function logEvent(event: Partial<AnalyticsEventRow>) {
  return supabase.from('analytics_events').insert(event)
}

export async function getRecentSessions(limit = 50) {
  return supabase
    .from('analytics_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
}

export async function getRecentEvents(limit = 100) {
  return supabase
    .from('analytics_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
}

export async function getEventCounts() {
  return supabase.from('analytics_events').select('event_type')
}

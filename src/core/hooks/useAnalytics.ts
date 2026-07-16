import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@core/contexts/AuthContext'
import { createSession, endSession, logEvent } from '@core/supabase/queries/analytics'
import { getDeviceInfo, getOrCreateVisitorId } from '@core/utils/deviceInfo'

// Custom, self-hosted analytics (Supabase-backed). No third-party trackers.
// Mounted once near the app root; also exposes trackFeature/trackError for
// use anywhere else in the app.
//
// RLS on analytics_sessions/analytics_events requires `user_id` to be either
// null or equal to auth.uid() (see supabase/policies.sql) — that's why we
// keep the current user id in a module-level ref and always send it, rather
// than letting requests silently fall back to anonymous.

const sessionIdRef = { current: null as string | null }
const sessionStartRef = { current: 0 }
const userIdRef = { current: null as string | null }

export function useAnalytics() {
  const location = useLocation()
  const { user } = useAuth()
  const initialized = useRef(false)

  useEffect(() => {
    userIdRef.current = user?.id ?? null
  }, [user?.id])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function startSession() {
      const { device, browser, os } = getDeviceInfo()
      const { isReturning } = getOrCreateVisitorId()
      const { data } = await createSession({
        user_id: userIdRef.current,
        device,
        browser,
        os,
        country: null,
        is_returning: isReturning,
        started_at: new Date().toISOString()
      })
      if (data) {
        sessionIdRef.current = data.id
        sessionStartRef.current = Date.now()
      }
    }

    startSession()

    const handleUnload = () => {
      if (!sessionIdRef.current) return
      const duration = (Date.now() - sessionStartRef.current) / 1000
      // Fire and forget; page is closing. This inserts a `session_end`
      // event rather than updating the session row (see analytics.ts).
      endSession(sessionIdRef.current, userIdRef.current, duration)
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [])

  useEffect(() => {
    logEvent({
      session_id: sessionIdRef.current,
      user_id: userIdRef.current,
      event_type: 'page_view',
      path: location.pathname
    })
  }, [location.pathname, user?.id])
}

export function trackFeature(label: string, metadata?: Record<string, unknown>) {
  logEvent({
    session_id: sessionIdRef.current,
    user_id: userIdRef.current,
    event_type: 'feature_usage',
    label,
    metadata: metadata ?? null
  })
}

export function trackError(label: string, metadata?: Record<string, unknown>) {
  logEvent({
    session_id: sessionIdRef.current,
    user_id: userIdRef.current,
    event_type: 'error',
    label,
    metadata: metadata ?? null
  })
}

export function useTrackFeature() {
  return useCallback(trackFeature, [])
}

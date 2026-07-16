import { supabase } from '../client'
import type { LogRow, AppSettingRow } from '../types'

export async function getAllUsers(limit = 100) {
  return supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(limit)
}

export async function updateUserRole(userId: string, role: 'user' | 'admin') {
  return supabase.from('profiles').update({ role }).eq('id', userId)
}

export async function getLogs(limit = 100) {
  return supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(limit)
}

// Client error telemetry — NOT a trusted audit log (see supabase/policies.sql).
// Only authenticated users can write, and only as themselves: always pass
// `user_id: user.id` from the caller, or the insert will be rejected by RLS.
export async function writeLog(log: Partial<LogRow>) {
  return supabase.from('logs').insert(log)
}

export async function getSetting(key: string) {
  return supabase.from('app_settings').select('*').eq('key', key).maybeSingle()
}

export async function upsertSetting(key: string, value: AppSettingRow['value']) {
  return supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() })
}

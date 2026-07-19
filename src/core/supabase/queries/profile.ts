import { supabase } from '../client'
import type { ProfileRow } from '../types'

export async function getProfile(userId: string) {
  return supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
}

// Fields a user is allowed to change about themselves from the client.
// `role`, `id`, `email`, `created_at`, `updated_at` are intentionally
// excluded — role changes are blocked server-side too (see the
// `guard_profile_role` trigger in supabase/policies.sql), but we also never
// want the client to *attempt* to send them.
export type SafeProfileUpdate = Partial<Pick<ProfileRow, 'full_name' | 'mobile' | 'avatar_url'>>

export async function updateProfile(userId: string, updates: SafeProfileUpdate) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id, full_name, email, mobile, avatar_url, role, created_at, updated_at')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    // The row wasn't returned. With RLS + grants configured correctly (see
    // supabase/policies.sql) this should never happen for a user updating
    // their own profile — if you hit this, it almost always means either:
    //   1) the profiles row for this user doesn't exist yet (re-run the
    //      backfill in supabase/migrations/fix_base_platform.sql), or
    //   2) the UPDATE/SELECT policies on `profiles` are out of sync with
    //      this migration.
    throw new Error(
      'Profile update did not return a row. Your profile record may be missing — see supabase/migrations/fix_base_platform.sql.'
    )
  }

  return { data, error: null as null }
}

export async function uploadAvatar(userId: string, file: File) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    cacheControl: '3600'
  })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

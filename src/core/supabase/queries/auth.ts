import { supabase } from '../client'

export async function signUp(email: string, password: string, fullName: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  })
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function sendPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
}

export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword })
}

export async function getSession() {
  return supabase.auth.getSession()
}

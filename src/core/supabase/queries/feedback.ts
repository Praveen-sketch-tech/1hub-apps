import { supabase } from '../client'
import type { FeedbackRow } from '../types'

export async function submitFeedback(feedback: Partial<FeedbackRow>) {
  return supabase.from('feedback').insert(feedback)
}

export async function getAllFeedback(limit = 100) {
  return supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(limit)
}

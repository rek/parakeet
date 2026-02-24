import { supabase } from './supabase'

export async function getCycleReview(programId: string, userId: string) {
  const { data } = await supabase
    .from('cycle_reviews')
    .select('*')
    .eq('program_id', programId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

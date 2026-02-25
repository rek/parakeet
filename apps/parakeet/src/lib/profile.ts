import { supabase } from './supabase'

export type BiologicalSex = 'female' | 'male' | 'prefer_not_to_say'

export interface Profile {
  id: string
  display_name: string | null
  biological_sex: BiologicalSex | null
  date_of_birth: string | null  // ISO date 'YYYY-MM-DD'
  created_at: string
}

export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, biological_sex, date_of_birth, created_at')
    .eq('id', user.id)
    .single()

  return data
}

export async function updateProfile(update: {
  display_name?: string
  biological_sex?: BiologicalSex
  date_of_birth?: string | null
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id)
  if (error) throw error
}

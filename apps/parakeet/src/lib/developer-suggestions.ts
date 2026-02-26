import { supabase } from './supabase'

export interface DeveloperSuggestion {
  id: string
  user_id: string
  program_id: string
  created_at: string
  description: string
  rationale: string
  developer_note: string
  priority: 'high' | 'medium' | 'low'
  status: 'unreviewed' | 'acknowledged' | 'implemented' | 'dismissed'
  reviewed_at: string | null
}

export async function getDeveloperSuggestions(): Promise<DeveloperSuggestion[]> {
  const { data, error } = await supabase
    .from('developer_suggestions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as DeveloperSuggestion[]
}

export async function updateSuggestionStatus(
  id: string,
  status: 'acknowledged' | 'implemented' | 'dismissed',
): Promise<void> {
  const { error } = await supabase
    .from('developer_suggestions')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

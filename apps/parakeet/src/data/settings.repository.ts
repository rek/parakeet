import { typedSupabase } from '../network/supabase-client';

export async function getPendingFormulaSuggestionsCount(userId: string): Promise<number> {
  const { count, error } = await typedSupabase
    .from('formula_configs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'ai_suggestion')
    .eq('is_active', false);

  if (error) throw error;
  return count ?? 0;
}

export async function getUnreviewedDeveloperSuggestionsCount(): Promise<number> {
  const { count, error } = await typedSupabase
    .from('developer_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'unreviewed');

  if (error) throw error;
  return count ?? 0;
}

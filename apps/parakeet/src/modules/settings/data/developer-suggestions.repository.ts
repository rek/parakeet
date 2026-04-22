// @spec docs/features/settings-and-tools/spec-bar-weight.md
import { typedSupabase } from '@platform/supabase';

export async function fetchDeveloperSuggestions(): Promise<unknown[]> {
  const { data, error } = await typedSupabase
    .from('developer_suggestions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function updateSuggestionStatusById(
  id: string,
  status: 'acknowledged' | 'implemented' | 'dismissed',
  reviewedAt: string
): Promise<void> {
  const { error } = await typedSupabase
    .from('developer_suggestions')
    .update({ status, reviewed_at: reviewedAt })
    .eq('id', id);

  if (error) throw error;
}

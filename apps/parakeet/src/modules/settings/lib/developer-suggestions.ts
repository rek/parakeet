import {
  fetchDeveloperSuggestions,
  updateSuggestionStatusById,
} from '../data/developer-suggestions.repository';

export interface DeveloperSuggestion {
  id: string;
  user_id: string;
  program_id: string;
  created_at: string;
  description: string;
  rationale: string;
  developer_note: string;
  priority: 'high' | 'medium' | 'low';
  status: 'unreviewed' | 'acknowledged' | 'implemented' | 'dismissed';
  reviewed_at: string | null;
}

export async function getDeveloperSuggestions(): Promise<
  DeveloperSuggestion[]
> {
  const data = await fetchDeveloperSuggestions();
  return data as DeveloperSuggestion[];
}

export async function updateSuggestionStatus(
  id: string,
  status: 'acknowledged' | 'implemented' | 'dismissed'
): Promise<void> {
  await updateSuggestionStatusById(id, status, new Date().toISOString());
}

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { settingsQueries } from '../data/settings.queries';
import { updateSuggestionStatus } from '../lib/developer-suggestions';

export function useDeveloperSuggestions() {
  const queryClient = useQueryClient();

  const { data: suggestions = [] } = useQuery({
    ...settingsQueries.developer.suggestions(),
    staleTime: 30 * 1000,
  });

  async function updateStatus(
    id: string,
    status: 'acknowledged' | 'implemented' | 'dismissed'
  ) {
    await updateSuggestionStatus(id, status);
    queryClient.invalidateQueries({
      queryKey: settingsQueries.developer.all(),
    });
  }

  return { suggestions, updateStatus };
}

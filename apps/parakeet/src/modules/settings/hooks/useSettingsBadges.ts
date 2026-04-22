// @spec docs/features/settings-and-tools/spec-bar-weight.md
import { useAuth } from '@modules/auth';
import { profileQueries } from '@modules/profile';
import { useQuery } from '@tanstack/react-query';

import { settingsQueries } from '../data/settings.queries';

export function useSettingsBadges() {
  const { user } = useAuth();

  const { data: pendingSuggestions } = useQuery(
    settingsQueries.formula.suggestionsCount(user?.id)
  );

  const { data: unreviewedDevCount } = useQuery(
    settingsQueries.developer.suggestionsCount()
  );

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    ...profileQueries.current(),
    staleTime: 5 * 60 * 1000,
  });

  return { pendingSuggestions, unreviewedDevCount, profile, isProfileLoading };
}

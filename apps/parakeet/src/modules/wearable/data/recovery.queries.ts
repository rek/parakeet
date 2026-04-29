import { queryOptions } from '@tanstack/react-query';

import { fetchTodaySnapshot } from './recovery.repository';

export const recoveryQueryKeys = {
  all: ['wearable', 'recovery'] as const,
  today: (userId: string) => [...recoveryQueryKeys.all, 'today', userId] as const,
};

export function todayRecoverySnapshotOptions(userId: string) {
  return queryOptions({
    queryKey: recoveryQueryKeys.today(userId),
    queryFn: () => fetchTodaySnapshot(userId),
    staleTime: 5 * 60 * 1000,
  });
}

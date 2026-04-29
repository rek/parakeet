import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@modules/auth';

import { todayRecoverySnapshotOptions } from '../data/recovery.queries';

export function useRecoverySnapshot() {
  const { user } = useAuth();
  return useQuery({
    ...todayRecoverySnapshotOptions(user?.id ?? ''),
    enabled: Boolean(user?.id),
  });
}

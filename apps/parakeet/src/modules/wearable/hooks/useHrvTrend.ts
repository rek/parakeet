import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@modules/auth';

import { hrvTrendOptions } from '../data/biometric.queries';

export function useHrvTrend() {
  const { user } = useAuth();
  return useQuery({
    ...hrvTrendOptions(user?.id ?? ''),
    enabled: Boolean(user?.id),
  });
}

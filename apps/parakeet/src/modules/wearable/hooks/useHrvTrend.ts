import { useAuth } from '@modules/auth';
import { useQuery } from '@tanstack/react-query';

import { hrvTrendOptions } from '../data/biometric.queries';

export function useHrvTrend() {
  const { user } = useAuth();
  return useQuery({
    ...hrvTrendOptions(user?.id ?? ''),
    enabled: Boolean(user?.id),
  });
}

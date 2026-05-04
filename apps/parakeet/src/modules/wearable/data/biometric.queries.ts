import { queryOptions } from '@tanstack/react-query';

import { fetchReadingsForBaseline } from './biometric.repository';

export const biometricQueryKeys = {
  all: ['wearable', 'biometric'] as const,
  trend: (userId: string, type: string, days: number) =>
    [...biometricQueryKeys.all, 'trend', userId, type, days] as const,
};

export function hrvTrendOptions(userId: string) {
  return queryOptions({
    queryKey: biometricQueryKeys.trend(userId, 'hrv_rmssd', 7),
    queryFn: () => fetchReadingsForBaseline(userId, 'hrv_rmssd', 7),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}

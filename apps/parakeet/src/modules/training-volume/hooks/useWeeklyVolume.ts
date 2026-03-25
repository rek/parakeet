import { useAuth } from '@modules/auth/hooks/useAuth';
import { getProfile } from '@modules/profile/application/profile.service';
import { getCurrentWeekLogs } from '@modules/session/application/session.service';
import {
  classifyVolumeStatus,
  computeRemainingCapacity,
  computeVolumeBreakdown,
  computeWeeklyVolume,
  getMusclesForLift,
} from '@parakeet/training-engine';
import { qk } from '@platform/query';
import { useQuery } from '@tanstack/react-query';

import { getMrvMevConfig } from '../lib/volume-config';

function rollingWindowStart(): string {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return start.toISOString().split('T')[0];
}

export function useWeeklyVolume() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.volume.weekly(user?.id, rollingWindowStart()),
    queryFn: async () => {
      const [logs, profile] = await Promise.all([
        getCurrentWeekLogs(user!.id),
        getProfile(),
      ]);
      const config = await getMrvMevConfig(user!.id, profile?.biological_sex);
      const weekly = computeWeeklyVolume(logs, getMusclesForLift);
      const breakdown = computeVolumeBreakdown({ sessionLogs: logs, muscleMapper: getMusclesForLift });
      const status = classifyVolumeStatus(weekly, config);
      const remaining = computeRemainingCapacity(weekly, config);
      const biologicalSex = profile?.biological_sex ?? null;
      return { weekly, status, remaining, config, breakdown, biologicalSex };
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });
}

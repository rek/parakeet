import { useAuth } from '@modules/auth';
import { getProfile } from '@modules/profile';
import { fetchActiveProgramMode } from '@modules/program';
import { getCurrentWeekLogs } from '@modules/session';
import {
  classifyVolumeStatus,
  computeRemainingCapacity,
  computeVolumeBreakdown,
  computeWeeklyVolume,
  getMusclesForLift,
} from '@parakeet/training-engine';
import { useQuery } from '@tanstack/react-query';

import { volumeQueries } from '../data/volume.queries';
import { getMrvMevConfig } from '../lib/volume-config';

function rollingWindowStart(): string {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return start.toISOString().split('T')[0];
}

export function useWeeklyVolume() {
  const { user } = useAuth();
  return useQuery({
    queryKey: volumeQueries.weekly(user?.id, rollingWindowStart()),
    queryFn: async () => {
      const [logs, profile, program] = await Promise.all([
        getCurrentWeekLogs(user!.id),
        getProfile(),
        fetchActiveProgramMode(user!.id),
      ]);
      const config = await getMrvMevConfig(user!.id, profile?.biological_sex);
      const weekly = computeWeeklyVolume(logs, getMusclesForLift);
      const breakdown = computeVolumeBreakdown({
        sessionLogs: logs,
        muscleMapper: getMusclesForLift,
      });
      const status = classifyVolumeStatus(weekly, config);
      const remaining = computeRemainingCapacity(weekly, config);
      const biologicalSex = profile?.biological_sex ?? null;

      // Count completed sessions: one main lift entry per session (exercise undefined)
      const completedSessions = logs.filter((l) => !l.exercise).length;
      const totalSessionsPerWeek = program?.training_days_per_week ?? 3;

      return {
        weekly,
        status,
        remaining,
        config,
        breakdown,
        biologicalSex,
        completedSessions,
        totalSessionsPerWeek,
      };
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });
}

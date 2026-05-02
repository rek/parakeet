// @spec docs/features/volume/spec-augmentation.md
import { useAuth } from '@modules/auth';
import { getProfile } from '@modules/profile';
import { fetchActiveProgramMode, getAllAuxMuscleMap } from '@modules/program';
import {
  classifyVolumeStatus,
  computeRemainingCapacity,
  computeVolumeBreakdown,
  computeWeeklyVolume,
  createMuscleMapper,
} from '@parakeet/training-engine';
import type { MuscleGroup } from '@parakeet/training-engine';
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
      const { getCurrentWeekLogs } = await import('@modules/session');
      const [logs, profile, program, auxMuscleMap] = await Promise.all([
        getCurrentWeekLogs(user!.id),
        getProfile(),
        fetchActiveProgramMode(user!.id),
        getAllAuxMuscleMap(user!.id),
      ]);
      const config = await getMrvMevConfig(user!.id, profile?.biological_sex);
      // Mapper credits user-defined exercises (e.g. "Pec Deck") to the muscles
      // the lifter selected when registering them — not the day's primary lift.
      const muscleMapper = createMuscleMapper(
        auxMuscleMap as Record<string, MuscleGroup[]>
      );
      const weekly = computeWeeklyVolume(logs, muscleMapper);
      const breakdown = computeVolumeBreakdown({
        sessionLogs: logs,
        muscleMapper,
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

import {
  CompletedSetLog,
  MUSCLE_GROUPS,
  MuscleGroup,
  MuscleMapper,
} from '../types';
import { rpeSetMultiplier } from './rpe-scaler';

interface ExerciseVolumeContribution {
  source: string;
  rawSets: number;
  effectiveSets: number;
  contribution: number;
  volumeAdded: number;
}

interface MuscleVolumeBreakdown {
  totalVolume: number;
  contributions: ExerciseVolumeContribution[];
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Mirrors computeWeeklyVolume but returns per-exercise detail instead of just totals.
 *
 * For each session log, attributes effective sets to muscles via the muscleMapper,
 * merging same-source entries across sessions. totalVolume matches computeWeeklyVolume
 * for the same inputs (same rounding).
 */
export function computeVolumeBreakdown({
  sessionLogs,
  muscleMapper,
}: {
  sessionLogs: CompletedSetLog[];
  muscleMapper: MuscleMapper;
}) {
  // Map<muscle, Map<source, {rawSets, effectiveSets, contribution}>>
  const byMuscle = new Map<string, Map<string, { rawSets: number; effectiveSets: number; contribution: number }>>();

  for (const log of sessionLogs) {
    const muscles = muscleMapper(log.lift, log.exercise);
    const effectiveSets: number = log.setRpes
      ? log.setRpes.reduce((sum: number, rpe) => sum + rpeSetMultiplier(rpe), 0)
      : log.completedSets;

    const source = log.exercise ?? (log.lift ? capitalize(log.lift) : 'Unknown');

    for (const { muscle, contribution } of muscles) {
      let muscleMap = byMuscle.get(muscle);
      if (!muscleMap) {
        muscleMap = new Map();
        byMuscle.set(muscle, muscleMap);
      }

      const existing = muscleMap.get(source);
      if (existing) {
        existing.rawSets += log.completedSets;
        existing.effectiveSets += effectiveSets;
      } else {
        muscleMap.set(source, {
          rawSets: log.completedSets,
          effectiveSets,
          contribution,
        });
      }
    }
  }

  return Object.fromEntries(
    MUSCLE_GROUPS.map((muscle) => {
      const muscleMap = byMuscle.get(muscle);
      if (!muscleMap || muscleMap.size === 0) {
        return [muscle, { totalVolume: 0, contributions: [] } as MuscleVolumeBreakdown];
      }

      const contributions: ExerciseVolumeContribution[] = [];
      let rawTotal = 0;

      for (const [source, data] of muscleMap) {
        const volumeAdded = data.effectiveSets * data.contribution;
        rawTotal += volumeAdded;
        contributions.push({
          source,
          rawSets: data.rawSets,
          effectiveSets: Math.round(data.effectiveSets * 100) / 100,
          contribution: data.contribution,
          volumeAdded: Math.round(volumeAdded * 100) / 100,
        });
      }

      contributions.sort((a, b) => b.volumeAdded - a.volumeAdded);

      return [muscle, { totalVolume: Math.round(rawTotal), contributions } as MuscleVolumeBreakdown];
    })
  ) as Record<MuscleGroup, MuscleVolumeBreakdown>;
}

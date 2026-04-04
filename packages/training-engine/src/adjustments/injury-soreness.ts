import type { Lift, TrainingDisruption } from '@parakeet/shared-types';

import type { MuscleGroup } from '../types';
import { getMusclesForLift } from '../volume/muscle-mapper';
import type { SorenessLevel } from './soreness-adjuster';

/**
 * Soreness levels injected for injury disruptions by severity.
 * Chosen to create meaningful exercise scorer penalties without
 * triggering recovery mode (which fires at soreness >= 9).
 *
 * - Minor (5): between mild (3) and sore (6) — moderate penalty
 * - Moderate (7): between sore (6) and very sore (8) — strong penalty
 * - Major: not mapped — session is already skipped by disruption adjuster
 */
export const INJURY_SORENESS: Partial<Record<string, SorenessLevel>> = {
  minor: 5 as SorenessLevel,
  moderate: 7 as SorenessLevel,
};

const VALID_LIFTS = new Set<string>(['squat', 'bench', 'deadlift']);

/**
 * Compute synthetic soreness overrides from active injury disruptions.
 *
 * For each injury with affected_lifts, maps those lifts to their muscle
 * groups and assigns a severity-based soreness level. When multiple injuries
 * overlap, the highest soreness wins per muscle.
 *
 * When all three lifts are affected, all muscles get elevated soreness and
 * the top-up scorer distributes volume roughly uniformly (no muscle is
 * preferred over another).
 */
export function computeInjurySorenessOverrides(
  activeDisruptions: TrainingDisruption[]
): Partial<Record<MuscleGroup, SorenessLevel>> {
  const overrides: Partial<Record<MuscleGroup, SorenessLevel>> = {};

  for (const d of activeDisruptions) {
    if (d.disruption_type !== 'injury' || !d.affected_lifts) continue;
    const injuredSoreness = INJURY_SORENESS[d.severity];
    if (!injuredSoreness) continue; // major → session skipped entirely
    for (const affectedLift of d.affected_lifts) {
      if (!VALID_LIFTS.has(affectedLift)) continue;
      for (const { muscle } of getMusclesForLift(affectedLift as Lift)) {
        const current = overrides[muscle] ?? 0;
        if (injuredSoreness > current) {
          overrides[muscle] = injuredSoreness;
        }
      }
    }
  }

  return overrides;
}

/**
 * Merge injury-derived soreness with actual soreness ratings.
 * Injury soreness only wins when higher than what the lifter reported.
 */
export function mergeSorenessRatings(
  actual: Partial<Record<MuscleGroup, SorenessLevel>>,
  injuryOverrides: Partial<Record<MuscleGroup, SorenessLevel>>
): Partial<Record<MuscleGroup, SorenessLevel>> {
  const merged: Partial<Record<MuscleGroup, SorenessLevel>> = { ...actual };
  for (const [muscle, level] of Object.entries(injuryOverrides)) {
    const existing = merged[muscle as MuscleGroup] ?? 0;
    if (level > existing) {
      merged[muscle as MuscleGroup] = level;
    }
  }
  return merged;
}

import type { PlannedSet } from '@parakeet/shared-types';

import type { SorenessLevel } from '../../adjustments/soreness-adjuster';
import type { MuscleGroup } from '../../types';

/** Mutable state threaded through each step of the JIT pipeline. */
export interface PipelineContext {
  intensityMultiplier: number;
  plannedCount: number;
  baseSetsCount: number;
  inRecoveryMode: boolean;
  skippedMainLift: boolean;
  rationale: string[];
  warnings: string[];
  baseSets: PlannedSet[];
  baseWeight: number;
  primaryMuscles: MuscleGroup[];
  worstSoreness: SorenessLevel;
  // Volume reduction tracking per source
  readinessSetsRemoved: number;
  cyclePhaseSetsRemoved: number;
  sorenessSetsRemoved: number;
  disruptionSetsRemoved: number;
}

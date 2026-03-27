import { PlannedSet, TrainingDisruption } from '@parakeet/shared-types';

import { DEFAULT_FORMULA_CONFIG_MALE } from '../cube/blocks';
import { JITInput } from '../generator/jit-session-generator';
import { MrvMevConfig, MuscleGroup } from '../types';
import { DEFAULT_MRV_MEV_CONFIG_MALE } from '../volume/mrv-mev-calculator';

export function baseInput(overrides?: Partial<JITInput>): JITInput {
  return {
    sessionId: 'sess-001',
    weekNumber: 1,
    blockNumber: 1,
    primaryLift: 'squat',
    intensityType: 'heavy',
    oneRmKg: 140,
    formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
    sorenessRatings: {},
    weeklyVolumeToDate: {},
    mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
    activeAuxiliaries: ['Pause Squat', 'Box Squat'],
    recentLogs: [],
    activeDisruptions: [],
    warmupConfig: { type: 'preset', name: 'standard' },
    ...overrides,
  };
}

export function makeDisruption(
  severity: 'minor' | 'moderate' | 'major',
  lift = 'squat'
): TrainingDisruption {
  return {
    id: 'dis-001',
    user_id: 'user-001',
    program_id: null,
    session_ids_affected: null,
    reported_at: new Date().toISOString(),
    disruption_type: 'injury',
    severity,
    affected_date_start: '2026-02-01',
    affected_date_end: null,
    affected_lifts: [lift],
    description: 'Knee injury',
    adjustment_applied: null,
    resolved_at: null,
    status: 'active',
  };
}

export function makeSets(
  count: number,
  weightKg: number,
  reps = 5
): PlannedSet[] {
  return Array.from({ length: count }, (_, i) => ({
    set_number: i + 1,
    weight_kg: weightKg,
    reps,
    rpe_target: 8,
  }));
}

export function atMevExcept(
  config: MrvMevConfig,
  ...except: MuscleGroup[]
): Partial<Record<MuscleGroup, number>> {
  const result: Partial<Record<MuscleGroup, number>> = {};
  for (const [muscle, { mev }] of Object.entries(config) as [
    MuscleGroup,
    { mev: number; mrv: number },
  ][]) {
    if (!except.includes(muscle)) result[muscle] = mev;
  }
  return result;
}

import { FormulaConfig, FormulaRestSeconds } from '../types'

export const DEFAULT_REST_SECONDS_MALE: FormulaRestSeconds = {
  block1: { heavy: 180, explosive: 120, rep: 120 },
  block2: { heavy: 210, explosive: 150, rep: 120 },
  block3: { heavy: 300, explosive: 180, rep: 150 },
  deload: 90,
  auxiliary: 90,
}

export const DEFAULT_REST_SECONDS_FEMALE: FormulaRestSeconds = {
  block1: { heavy: 150, explosive: 90, rep: 90 },
  block2: { heavy: 180, explosive: 120, rep: 90 },
  block3: { heavy: 270, explosive: 150, rep: 120 },
  deload: 90,
  auxiliary: 90,
}

export const DEFAULT_FORMULA_CONFIG_MALE: FormulaConfig = {
  block1: {
    heavy:     { pct: 0.80, sets: 2, reps: 5,                        rpe_target: 8.5 },
    explosive: { pct: 0.65, sets: 3, reps: 8,                        rpe_target: 7.0 },
    rep:       { pct: 0.70, sets_min: 2, sets_max: 3, reps_min: 8,  reps_max: 12, rpe_target: 8.0 },
  },
  block2: {
    heavy:     { pct: 0.85, sets: 2, reps: 3,                        rpe_target: 9.0 },
    explosive: { pct: 0.70, sets: 2, reps: 6,                        rpe_target: 7.5 },
    rep:       { pct: 0.80, sets_min: 2, sets_max: 3, reps_min: 4,  reps_max: 8,  rpe_target: 8.0 },
  },
  block3: {
    heavy:     { pct: 0.90, sets: 4, reps: 1, reps_max: 2,           rpe_target: 9.5 },
    explosive: { pct: 0.75, sets: 2, reps: 2,                        rpe_target: 8.0 },
    rep:       { pct: 0.85, sets_min: 2, sets_max: 3, reps_min: 3,  reps_max: 5,  rpe_target: 8.5 },
  },
  deload: { pct: 0.40, sets: 3, reps: 5, rpe_target: 5.0 },
  progressive_overload: {
    heavy_pct_increment_per_block: 0.05,
  },
  training_max_increase: {
    bench_min: 2.5,
    bench_max: 5,
    squat_min: 5,
    squat_max: 10,
    deadlift_min: 5,
    deadlift_max: 10,
  },
  rounding_increment_kg: 2.5,
  rest_seconds: DEFAULT_REST_SECONDS_MALE,
}

export const DEFAULT_FORMULA_CONFIG_FEMALE: FormulaConfig = {
  block1: {
    heavy:     { pct: 0.80, sets: 3, reps: 5,                        rpe_target: 8.0 },
    explosive: { pct: 0.65, sets: 3, reps: 8,                        rpe_target: 6.5 },
    rep:       { pct: 0.70, sets_min: 3, sets_max: 4, reps_min: 8,  reps_max: 12, rpe_target: 7.5 },
  },
  block2: {
    heavy:     { pct: 0.85, sets: 3, reps: 3,                        rpe_target: 8.5 },
    explosive: { pct: 0.70, sets: 2, reps: 6,                        rpe_target: 7.0 },
    rep:       { pct: 0.80, sets_min: 3, sets_max: 4, reps_min: 4,  reps_max: 8,  rpe_target: 7.5 },
  },
  block3: {
    heavy:     { pct: 0.90, sets: 4, reps: 1, reps_max: 2,           rpe_target: 9.0 },
    explosive: { pct: 0.75, sets: 2, reps: 2,                        rpe_target: 7.5 },
    rep:       { pct: 0.85, sets_min: 2, sets_max: 3, reps_min: 3,  reps_max: 5,  rpe_target: 8.0 },
  },
  deload: { pct: 0.40, sets: 3, reps: 5, rpe_target: 5.0 },
  progressive_overload: {
    heavy_pct_increment_per_block: 0.05,
  },
  training_max_increase: {
    bench_min: 2.5,
    bench_max: 2.5,
    squat_min: 5,
    squat_max: 7.5,
    deadlift_min: 5,
    deadlift_max: 7.5,
  },
  rounding_increment_kg: 2.5,
  rest_seconds: DEFAULT_REST_SECONDS_FEMALE,
}

export function getDefaultFormulaConfig(biologicalSex?: 'female' | 'male'): FormulaConfig {
  return biologicalSex === 'female' ? DEFAULT_FORMULA_CONFIG_FEMALE : DEFAULT_FORMULA_CONFIG_MALE
}

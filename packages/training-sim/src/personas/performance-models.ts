import { PerformanceModelConfig } from '../types'

/** Consistent lifter — slow steady gains, RPE tracks targets well */
export const ADHERENT_MODEL: PerformanceModelConfig = {
  oneRmGainPerCycle: 0.01,
  rpeDeviation: 0,
  rpeFatiguePerWeek: 0.15,
}

/** Beginner — faster gains, RPE tends lower (things feel easier early on) */
export const BEGINNER_MODEL: PerformanceModelConfig = {
  oneRmGainPerCycle: 0.02,
  rpeDeviation: -0.5,
  rpeFatiguePerWeek: 0.1,
}

/** Fatigued lifter — RPE runs higher than target, moderate gains */
export const FATIGUED_MODEL: PerformanceModelConfig = {
  oneRmGainPerCycle: 0.005,
  rpeDeviation: 0.5,
  rpeFatiguePerWeek: 0.25,
}

/** Overtrained — RPE much higher than target, minimal gains */
export const OVERTRAINED_MODEL: PerformanceModelConfig = {
  oneRmGainPerCycle: 0,
  rpeDeviation: 1.0,
  rpeFatiguePerWeek: 0.3,
}

/** Struggling lifter — minimal gains, frequently fails sets (15% of sets) */
export const STRUGGLING_MODEL: PerformanceModelConfig = {
  oneRmGainPerCycle: 0.005,
  rpeDeviation: 0.5,
  rpeFatiguePerWeek: 0.3,
  setFailureRate: 0.15,
  failureRepReduction: 1,
}

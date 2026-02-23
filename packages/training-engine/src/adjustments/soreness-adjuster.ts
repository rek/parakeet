import { Lift, PlannedSet } from '@parakeet/shared-types'
import { roundToNearest } from '../formulas/weight-rounding'
import { MuscleGroup } from '../types'

export type SorenessLevel = 1 | 2 | 3 | 4 | 5

export interface SorenessModifier {
  setReduction: number
  intensityMultiplier: number
  recoveryMode: boolean
  warning: string | null
}

const SORENESS_TABLE: Record<SorenessLevel, SorenessModifier> = {
  1: { setReduction: 0, intensityMultiplier: 1.00, recoveryMode: false, warning: null },
  2: { setReduction: 0, intensityMultiplier: 1.00, recoveryMode: false, warning: null },
  3: { setReduction: 1, intensityMultiplier: 1.00, recoveryMode: false, warning: 'Moderate soreness — reduced 1 set' },
  4: { setReduction: 2, intensityMultiplier: 0.95, recoveryMode: false, warning: 'High soreness — reduced volume and intensity 5%' },
  5: { setReduction: 0, intensityMultiplier: 0.00, recoveryMode: true,  warning: 'Severe soreness — recovery session only (40% × 3×5)' },
}

export function getSorenessModifier(sorenessLevel: SorenessLevel): SorenessModifier {
  return SORENESS_TABLE[sorenessLevel]
}

export function applySorenessToSets(
  plannedSets: PlannedSet[],
  modifier: SorenessModifier,
  minSets = 1,
): PlannedSet[] {
  if (plannedSets.length === 0) return plannedSets

  if (modifier.recoveryMode) {
    const recoveryWeight = Math.max(20, roundToNearest(plannedSets[0].weight_kg * 0.40))
    return Array.from({ length: 3 }, (_, i) => ({
      set_number: i + 1,
      weight_kg: recoveryWeight,
      reps: 5,
      rpe_target: 5.0,
    }))
  }

  const targetCount = Math.max(minSets, plannedSets.length - modifier.setReduction)
  const reduced = plannedSets.slice(0, targetCount)

  if (modifier.intensityMultiplier === 1.0) return reduced

  return reduced.map((s) => ({
    ...s,
    weight_kg: roundToNearest(s.weight_kg * modifier.intensityMultiplier),
  }))
}

const PRIMARY_MUSCLES: Record<Lift, MuscleGroup[]> = {
  squat:    ['quads', 'glutes', 'lower_back'],
  bench:    ['chest', 'triceps', 'shoulders'],
  deadlift: ['hamstrings', 'glutes', 'lower_back', 'upper_back'],
}

export function getPrimaryMusclesForSession(lift: Lift): MuscleGroup[] {
  return PRIMARY_MUSCLES[lift]
}

export function getWorstSoreness(
  muscles: MuscleGroup[],
  ratings: Partial<Record<MuscleGroup, SorenessLevel>>,
): SorenessLevel {
  return muscles.reduce<SorenessLevel>((worst, muscle) => {
    const level = ratings[muscle] ?? 1
    return (level > worst ? level : worst) as SorenessLevel
  }, 1)
}

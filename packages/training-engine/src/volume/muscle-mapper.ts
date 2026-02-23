import { Lift } from '@parakeet/shared-types'
import { MuscleContribution } from '../types'

const LIFT_MUSCLES: Record<string, MuscleContribution[]> = {
  squat: [
    { muscle: 'quads',      contribution: 1.0 },
    { muscle: 'glutes',     contribution: 1.0 },
    { muscle: 'hamstrings', contribution: 0.5 },
    { muscle: 'lower_back', contribution: 0.5 },
  ],
  bench: [
    { muscle: 'chest',     contribution: 1.0 },
    { muscle: 'triceps',   contribution: 0.5 },
    { muscle: 'shoulders', contribution: 0.5 },
  ],
  deadlift: [
    { muscle: 'hamstrings', contribution: 1.0 },
    { muscle: 'glutes',     contribution: 1.0 },
    { muscle: 'lower_back', contribution: 1.0 },
    { muscle: 'upper_back', contribution: 0.5 },
  ],
}

export function getMusclesForLift(lift: Lift, _exercise?: string): MuscleContribution[] {
  return LIFT_MUSCLES[lift] ?? []
}

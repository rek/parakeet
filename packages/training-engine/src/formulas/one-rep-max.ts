import { InvalidInputError } from '../errors'

function validateInputs(weightKg: number, reps: number): void {
  if (weightKg <= 0 || reps <= 0 || reps > 20) {
    throw new InvalidInputError(
      `Invalid inputs: weightKg=${weightKg}, reps=${reps}. weightKg must be > 0, reps must be between 1 and 20.`,
    )
  }
}

export function estimateOneRepMax_Epley(weightKg: number, reps: number): number {
  validateInputs(weightKg, reps)
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export function estimateOneRepMax_Brzycki(weightKg: number, reps: number): number {
  validateInputs(weightKg, reps)
  if (reps === 1) return weightKg
  return weightKg / (1.0278 - 0.0278 * reps)
}

export function estimateOneRepMax(
  weightKg: number,
  reps: number,
  formula: '1rm_epley' | '1rm_brzycki' = '1rm_epley',
): number {
  if (formula === '1rm_brzycki') return estimateOneRepMax_Brzycki(weightKg, reps)
  return estimateOneRepMax_Epley(weightKg, reps)
}

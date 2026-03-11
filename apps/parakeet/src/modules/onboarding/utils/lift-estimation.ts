import { estimateOneRepMax_Epley } from '@parakeet/training-engine'

interface LiftState {
  type: '1rm' | '3rm'
  weightKg: string
  reps: string
}

/**
 * Compute a display string for the estimated 1RM given the current lift input state.
 * Returns '—' when the input is invalid or estimation fails.
 */
export function computeEstimated1RM(state: LiftState): string {
  const weight = parseFloat(state.weightKg)
  if (!weight || weight <= 0) return '—'

  if (state.type === '1rm') {
    return weight.toFixed(1) + ' kg'
  }

  const reps = parseInt(state.reps, 10)
  if (!reps || reps < 2 || reps > 10) return '—'

  try {
    const estimated = estimateOneRepMax_Epley(weight, reps)
    return estimated.toFixed(1) + ' kg'
  } catch {
    return '—'
  }
}

/**
 * Returns true when the lift state has sufficient valid input to proceed.
 */
export function isLiftValid(state: LiftState): boolean {
  const weight = parseFloat(state.weightKg)
  if (!weight || weight <= 0) return false
  if (state.type === '3rm') {
    const reps = parseInt(state.reps, 10)
    if (!reps || reps < 2 || reps > 10) return false
  }
  return true
}

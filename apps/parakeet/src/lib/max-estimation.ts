import { roundToNearest } from '@parakeet/training-engine'
import type { Lift } from '@parakeet/shared-types'
import type { BiologicalSex } from './profile'

const DEFAULT_BODYWEIGHT_KG: Record<BiologicalSex, number> = {
  female: 70,
  male: 85,
}

const LIFT_BODYWEIGHT_MULTIPLIERS: Record<BiologicalSex, Record<Lift, number>> = {
  female: {
    squat: 1.05,
    bench: 0.65,
    deadlift: 1.25,
  },
  male: {
    squat: 1.35,
    bench: 1.0,
    deadlift: 1.65,
  },
}

const MIN_ESTIMATED_MAX_KG: Record<Lift, number> = {
  squat: 40,
  bench: 30,
  deadlift: 50,
}

function getAgeFromDob(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null
  const birth = new Date(dateOfBirth)
  if (Number.isNaN(birth.getTime())) return null

  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const hasBirthdayPassed =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate())
  if (!hasBirthdayPassed) age -= 1

  return age >= 0 ? age : null
}

function getAgeMultiplier(age: number | null): number {
  if (age === null) return 0.95
  if (age < 20) return 0.92
  if (age <= 29) return 1.0
  if (age <= 39) return 0.97
  if (age <= 49) return 0.92
  if (age <= 59) return 0.86
  return 0.78
}

interface EstimateInput {
  lift: Lift
  biologicalSex: BiologicalSex | null
  dateOfBirth: string | null
  bodyweightKg?: number | null
}

export function estimateOneRmKgFromProfile(input: EstimateInput): number {
  const sex: BiologicalSex = input.biologicalSex ?? 'male'
  const bodyweightKg =
    input.bodyweightKg != null && input.bodyweightKg > 0
      ? input.bodyweightKg
      : DEFAULT_BODYWEIGHT_KG[sex]

  const base = bodyweightKg * LIFT_BODYWEIGHT_MULTIPLIERS[sex][input.lift]
  const age = getAgeFromDob(input.dateOfBirth)
  const withAge = base * getAgeMultiplier(age)
  const rounded = roundToNearest(withAge, 2.5)

  return Math.max(rounded, MIN_ESTIMATED_MAX_KG[input.lift])
}

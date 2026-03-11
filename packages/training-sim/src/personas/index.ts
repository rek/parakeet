import { Persona } from '../types'

export const ADAM: Persona = {
  name: 'Adam',
  biologicalSex: 'male',
  ageYears: 43,
  bodyweightKg: 92,
  squatMaxKg: 170,
  benchMaxKg: 120,
  deadliftMaxKg: 200,
  trainingAge: 'intermediate',
}

export const LISA: Persona = {
  name: 'Lisa',
  biologicalSex: 'female',
  ageYears: 35,
  bodyweightKg: 65,
  squatMaxKg: 100,
  benchMaxKg: 55,
  deadliftMaxKg: 120,
  trainingAge: 'intermediate',
}

export const INJURED_IVAN: Persona = {
  name: 'Injured Ivan',
  biologicalSex: 'male',
  ageYears: 40,
  bodyweightKg: 85,
  squatMaxKg: 150,
  benchMaxKg: 100,
  deadliftMaxKg: 180,
  trainingAge: 'intermediate',
}

export const BUSY_BEE: Persona = {
  name: 'Busy Bee',
  biologicalSex: 'female',
  ageYears: 30,
  bodyweightKg: 70,
  squatMaxKg: 80,
  benchMaxKg: 45,
  deadliftMaxKg: 100,
  trainingAge: 'beginner',
}

export const SARAH: Persona = {
  name: 'Sarah',
  biologicalSex: 'female',
  ageYears: 43,
  bodyweightKg: 68,
  squatMaxKg: 110,
  benchMaxKg: 60,
  deadliftMaxKg: 130,
  trainingAge: 'advanced',
}

// Junior male — 19yo, low training age, lighter weights, high recovery capacity
export const JUNIOR_JAKE: Persona = {
  name: 'Junior Jake',
  biologicalSex: 'male',
  ageYears: 19,
  bodyweightKg: 78,
  squatMaxKg: 120,
  benchMaxKg: 80,
  deadliftMaxKg: 150,
  trainingAge: 'beginner',
}

// Elite female — 28yo, competition-level lifter, high absolute strength
export const ELITE_EVA: Persona = {
  name: 'Elite Eva',
  biologicalSex: 'female',
  ageYears: 28,
  bodyweightKg: 72,
  squatMaxKg: 145,
  benchMaxKg: 85,
  deadliftMaxKg: 170,
  trainingAge: 'advanced',
}

export const ALL_PERSONAS: Persona[] = [ADAM, LISA, INJURED_IVAN, BUSY_BEE, SARAH, JUNIOR_JAKE, ELITE_EVA]

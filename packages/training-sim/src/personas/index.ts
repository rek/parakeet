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

export const ALL_PERSONAS: Persona[] = [ADAM, LISA, INJURED_IVAN, BUSY_BEE]

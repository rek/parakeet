import { estimateOneRepMax_Epley, gramsToKg, kgToGrams } from '@parakeet/training-engine'
import type { Lift } from '@parakeet/shared-types'
import { supabase } from './supabase'

interface LiftInput {
  type: '1rm' | '3rm'
  weightKg: number
  reps?: number
}

export interface LifterMaxesInput {
  squat:    LiftInput
  bench:    LiftInput
  deadlift: LiftInput
}

function resolve1Rm(input: LiftInput): number {
  if (input.type === '3rm' && input.reps) {
    return estimateOneRepMax_Epley(input.weightKg, input.reps)
  }
  return input.weightKg
}

function inferSource(input: LifterMaxesInput): string {
  const types = [input.squat.type, input.bench.type, input.deadlift.type]
  if (types.every((t) => t === '1rm')) return 'input_1rm'
  if (types.every((t) => t === '3rm')) return 'input_3rm'
  return 'mixed'
}

export async function submitMaxes(input: LifterMaxesInput) {
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const { data } = await supabase
    .from('lifter_maxes')
    .insert({
      user_id:              userId,
      squat_1rm_grams:      kgToGrams(resolve1Rm(input.squat)),
      bench_1rm_grams:      kgToGrams(resolve1Rm(input.bench)),
      deadlift_1rm_grams:   kgToGrams(resolve1Rm(input.deadlift)),
      squat_input_grams:    kgToGrams(input.squat.weightKg),
      squat_input_reps:     input.squat.type === '3rm' ? (input.squat.reps ?? null) : null,
      bench_input_grams:    kgToGrams(input.bench.weightKg),
      bench_input_reps:     input.bench.type === '3rm' ? (input.bench.reps ?? null) : null,
      deadlift_input_grams: kgToGrams(input.deadlift.weightKg),
      deadlift_input_reps:  input.deadlift.type === '3rm' ? (input.deadlift.reps ?? null) : null,
      source:               inferSource(input),
      recorded_at:          new Date().toISOString(),
    })
    .select()
    .single()

  return data
}

export async function getCurrentMaxes(userId: string) {
  const { data } = await supabase
    .from('lifter_maxes')
    .select('*')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getCurrentOneRmKg(userId: string, lift: Lift): Promise<number | null> {
  const maxes = await getCurrentMaxes(userId)
  if (!maxes) return null
  const grams = maxes[`${lift}_1rm_grams`] as number | undefined
  return grams != null ? gramsToKg(grams) : null
}

import { estimateOneRepMax_Epley, gramsToKg, kgToGrams } from '@parakeet/training-engine'
import { LifterMaxesInputSchema } from '@parakeet/shared-types'
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

type MaxSource = 'input_1rm' | 'input_3rm' | 'mixed'

function resolve1Rm(input: LiftInput): number {
  if (input.type === '3rm' && input.reps) {
    return estimateOneRepMax_Epley(input.weightKg, input.reps)
  }
  return input.weightKg
}

function inferSource(input: LifterMaxesInput): MaxSource {
  const types = [input.squat.type, input.bench.type, input.deadlift.type]
  if (types.every((t) => t === '1rm')) return 'input_1rm'
  if (types.every((t) => t === '3rm')) return 'input_3rm'
  return 'mixed'
}

export async function submitMaxes(input: LifterMaxesInput) {
  const parsed = LifterMaxesInputSchema.safeParse({
    squat: {
      type: input.squat.type,
      weight_kg: input.squat.weightKg,
      ...(input.squat.type === '3rm' ? { reps: input.squat.reps } : {}),
    },
    bench: {
      type: input.bench.type,
      weight_kg: input.bench.weightKg,
      ...(input.bench.type === '3rm' ? { reps: input.bench.reps } : {}),
    },
    deadlift: {
      type: input.deadlift.type,
      weight_kg: input.deadlift.weightKg,
      ...(input.deadlift.type === '3rm' ? { reps: input.deadlift.reps } : {}),
    },
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid max input')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const userId = user.id

  const { data, error } = await supabase
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

  if (error) throw error
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

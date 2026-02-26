import { z } from 'zod'

export const LiftInputSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('1rm'),
      weight_kg: z.number().positive().max(500),
    })
    .strict(),
  z
    .object({
      type: z.literal('3rm'),
      weight_kg: z.number().positive().max(500),
      reps: z.number().int().min(2).max(10),
    })
    .strict(),
])

export type LiftInput = z.infer<typeof LiftInputSchema>

export const LifterMaxesInputSchema = z
  .object({
    squat: LiftInputSchema,
    bench: LiftInputSchema,
    deadlift: LiftInputSchema,
  })
  .strict()

export type LifterMaxesInput = z.infer<typeof LifterMaxesInputSchema>

export const LifterMaxesResponseSchema = z
  .object({
    id: z.string().uuid(),
    calculated_1rm: z.object({
      squat_kg: z.number().positive(),
      bench_kg: z.number().positive(),
      deadlift_kg: z.number().positive(),
    }),
    source: z.enum(['input_1rm', 'input_3rm', 'mixed', 'system_calculated']),
    recorded_at: z.string().datetime(),
  })
  .strict()

export type LifterMaxesResponse = z.infer<typeof LifterMaxesResponseSchema>

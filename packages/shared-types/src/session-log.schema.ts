import { z } from 'zod'

export const ActualSetSchema = z
  .object({
    set_number: z.number().int().positive(),
    weight_kg: z.number().positive(),
    reps_completed: z.number().int().min(0),
    rpe_actual: z.number().min(6).max(10).optional(),
    notes: z.string().optional(),
  })
  .strict()

export type ActualSet = z.infer<typeof ActualSetSchema>

export const CompleteSessionSchema = z
  .object({
    actual_sets: z.array(ActualSetSchema).min(1),
    session_rpe: z.number().min(6).max(10).optional(),
    session_notes: z.string().optional(),
    started_at: z.string().datetime().optional(),
    completed_at: z.string().datetime().optional(),
  })
  .strict()

export type CompleteSession = z.infer<typeof CompleteSessionSchema>

export const SessionLogSchema = z
  .object({
    id: z.string().uuid(),
    session_id: z.string().uuid(),
    logged_at: z.string().datetime(),
    actual_sets: z.array(ActualSetSchema),
    session_rpe: z.number().min(6).max(10).nullable(),
    completion_pct: z.number().min(0).max(100).nullable(),
    performance_vs_plan: z.enum(['under', 'at', 'over', 'incomplete']).nullable(),
  })
  .strict()

export type SessionLog = z.infer<typeof SessionLogSchema>

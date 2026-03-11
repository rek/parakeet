import { z } from 'zod';

export const ActualSetSchema = z
  .object({
    exercise: z.string().optional(),
    set_number: z.number().int().positive(),
    weight_grams: z.number().int().nonnegative(),
    reps_completed: z.number().int().min(0),
    rpe_actual: z.number().min(6).max(10).optional(),
    actual_rest_seconds: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
    exercise_type: z.enum(['weighted', 'bodyweight', 'timed']).optional(),
  })
  .strict();

export type ActualSet = z.infer<typeof ActualSetSchema>;

export const CompleteSessionSchema = z
  .object({
    actual_sets: z.array(ActualSetSchema).min(1),
    session_rpe: z.number().min(6).max(10).optional(),
    session_notes: z.string().optional(),
    started_at: z.iso.datetime({ offset: true }).optional(),
    completed_at: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export type CompleteSession = z.infer<typeof CompleteSessionSchema>;

export const SessionLogSchema = z
  .object({
    id: z.uuid(),
    session_id: z.uuid(),
    logged_at: z.iso.datetime({ offset: true }),
    actual_sets: z.array(ActualSetSchema),
    session_rpe: z.number().min(6).max(10).nullable(),
    completion_pct: z.number().min(0).max(100).nullable(),
    performance_vs_plan: z
      .enum(['under', 'at', 'over', 'incomplete'])
      .nullable(),
  })
  .strict();

export type SessionLog = z.infer<typeof SessionLogSchema>;

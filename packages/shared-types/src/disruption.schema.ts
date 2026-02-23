import { z } from 'zod'

export const DisruptionTypeSchema = z.enum([
  'injury',
  'illness',
  'travel',
  'fatigue',
  'equipment_unavailable',
  'unprogrammed_event',
  'other',
])

export type DisruptionType = z.infer<typeof DisruptionTypeSchema>

export const SeveritySchema = z.enum(['minor', 'moderate', 'major'])

export type Severity = z.infer<typeof SeveritySchema>

export const CreateDisruptionSchema = z
  .object({
    disruption_type: DisruptionTypeSchema,
    severity: SeveritySchema,
    affected_date_start: z.string().date(),
    affected_date_end: z.string().date().optional(),
    affected_lifts: z.array(z.enum(['squat', 'bench', 'deadlift'])).optional(),
    description: z.string().optional(),
    session_ids_affected: z.array(z.string().uuid()).optional(),
  })
  .strict()

export type CreateDisruption = z.infer<typeof CreateDisruptionSchema>

export const AdjustmentSuggestionSchema = z
  .object({
    session_id: z.string().uuid(),
    action: z.enum(['skip', 'reduce_volume', 'reduce_intensity', 'substitute', 'reschedule']),
    reduction_pct: z.number().min(0).max(100).optional(),
    rationale: z.string(),
    substitution_note: z.string().optional(),
  })
  .strict()

export type AdjustmentSuggestion = z.infer<typeof AdjustmentSuggestionSchema>

export const DisruptionSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    program_id: z.string().uuid().nullable(),
    session_ids_affected: z.array(z.string().uuid()).nullable(),
    reported_at: z.string().datetime(),
    disruption_type: DisruptionTypeSchema,
    severity: SeveritySchema,
    affected_date_start: z.string().date(),
    affected_date_end: z.string().date().nullable(),
    affected_lifts: z.array(z.string()).nullable(),
    description: z.string().nullable(),
    resolved_at: z.string().datetime().nullable(),
    status: z.enum(['active', 'resolved', 'monitoring']),
  })
  .strict()

export type TrainingDisruption = z.infer<typeof DisruptionSchema>

export const DisruptionWithSuggestionsSchema = DisruptionSchema.extend({
  suggested_adjustments: z.array(AdjustmentSuggestionSchema),
})

export type DisruptionWithSuggestions = z.infer<typeof DisruptionWithSuggestionsSchema>

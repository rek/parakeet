import { z } from 'zod';

export const DisruptionTypeSchema = z.enum([
  'injury',
  'illness',
  'travel',
  'fatigue',
  'equipment_unavailable',
  'unprogrammed_event',
  'other',
]);

export type DisruptionType = z.infer<typeof DisruptionTypeSchema>;

export const SeveritySchema = z.enum(['minor', 'moderate', 'major']);

export type Severity = z.infer<typeof SeveritySchema>;

export const CreateDisruptionSchema = z
  .object({
    disruption_type: DisruptionTypeSchema,
    severity: SeveritySchema,
    affected_date_start: z.iso.date(),
    affected_date_end: z.iso.date().optional(),
    affected_lifts: z.array(z.enum(['squat', 'bench', 'deadlift'])).optional(),
    description: z.string().optional(),
    // Distinct from `description`: short label for an unprogrammed event
    // (e.g. "Hyrox", "5k race"). Surfaced in the chip and review screen
    // instead of mashing into `description`. See finding #8.
    event_name: z.string().optional(),
    session_ids_affected: z.array(z.uuid()).optional(),
  })
  .strict();

export type CreateDisruption = z.infer<typeof CreateDisruptionSchema>;

export const AdjustmentSuggestionSchema = z
  .object({
    session_id: z.uuid(),
    action: z.enum([
      'weight_reduced',
      'reps_reduced',
      'session_skipped',
      'exercise_substituted',
    ]),
    reduction_pct: z.number().min(0).max(100).optional(),
    reps_reduction: z.number().int().positive().optional(),
    rationale: z.string(),
    substitution_note: z.string().optional(),
  })
  .strict();

export type AdjustmentSuggestion = z.infer<typeof AdjustmentSuggestionSchema>;

export const DisruptionSchema = z
  .object({
    id: z.uuid(),
    user_id: z.uuid(),
    program_id: z.uuid().nullable(),
    session_ids_affected: z.array(z.uuid()).nullable(),
    reported_at: z.iso.datetime({ offset: true }),
    disruption_type: DisruptionTypeSchema,
    severity: SeveritySchema,
    affected_date_start: z.iso.date(),
    affected_date_end: z.iso.date().nullable(),
    affected_lifts: z.array(z.string()).nullable(),
    description: z.string().nullable(),
    // Optional separate event label for unprogrammed events. Migration adds
    // the column; until then the repository will gracefully omit it from
    // writes (see finding #8).
    event_name: z.string().nullable().optional(),
    adjustment_applied: z.array(AdjustmentSuggestionSchema).nullable(),
    resolved_at: z.iso.datetime({ offset: true }).nullable(),
    status: z.enum(['active', 'resolved', 'monitoring']),
  })
  .strict();

export type TrainingDisruption = z.infer<typeof DisruptionSchema>;

export const SessionImpactPreviewSchema = z
  .object({
    session_id: z.uuid(),
    planned_date: z.iso.date().nullable(),
    primary_lift: z.string(),
    action: z.enum([
      'weight_reduced',
      'reps_reduced',
      'session_skipped',
      'exercise_substituted',
    ]),
    before_weight_kg: z.number().nullable().optional(),
    after_weight_kg: z.number().nullable().optional(),
    before_reps: z.number().int().nullable().optional(),
    after_reps: z.number().int().nullable().optional(),
  })
  .strict();

export type SessionImpactPreview = z.infer<typeof SessionImpactPreviewSchema>;

export const DisruptionWithSuggestionsSchema = DisruptionSchema.extend({
  suggested_adjustments: z.array(AdjustmentSuggestionSchema),
  // Sessions with null planned_sets that will be adjusted at JIT time
  future_sessions_count: z.number().int().nonnegative().optional(),
  // Per-session before/after preview rows so the review screen can render
  // [Day-of-week, lift, action, before → after] (finding #4).
  session_impacts: z.array(SessionImpactPreviewSchema).optional(),
});

export type DisruptionWithSuggestions = z.infer<
  typeof DisruptionWithSuggestionsSchema
>;

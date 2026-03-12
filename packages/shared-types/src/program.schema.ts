import { z } from 'zod';

export const LiftSchema = z.enum(['squat', 'bench', 'deadlift']);

export type Lift = z.infer<typeof LiftSchema>;

export const IntensityTypeSchema = z.enum([
  'heavy',
  'explosive',
  'rep',
  'deload',
]);

export type IntensityType = z.infer<typeof IntensityTypeSchema>;

export const BlockNumberSchema = z.number().int().min(1);

export type BlockNumber = z.infer<typeof BlockNumberSchema>;

// weight_kg must be a positive multiple of 2.5 kg
const weightKgSchema = z
  .number()
  .positive()
  .refine((n) => Math.round(n * 10) % 25 === 0, {
    message: 'Weight must be a multiple of 2.5 kg',
  });

export const PlannedSetSchema = z
  .object({
    set_number: z.number().int().positive(),
    weight_kg: weightKgSchema,
    reps: z.number().int().positive(),
    rpe_target: z.number().min(6).max(10).optional(),
    reps_range: z
      .tuple([z.number().int().positive(), z.number().int().positive()])
      .optional(),
  })
  .strict();

export type PlannedSet = z.infer<typeof PlannedSetSchema>;

export const SessionSchema = z
  .object({
    id: z.uuid(),
    program_id: z.uuid(),
    week_number: z.number().int().positive(),
    day_number: z.number().int().min(1).max(7),
    primary_lift: LiftSchema,
    intensity_type: IntensityTypeSchema,
    block_number: z.number().int().min(1).nullable(),
    is_deload: z.boolean(),
    planned_sets: z.array(PlannedSetSchema).nullable(),
    status: z.enum([
      'planned',
      'in_progress',
      'completed',
      'skipped',
      'missed',
    ]),
    planned_date: z.iso.date().nullable(),
  })
  .strict();

export type Session = z.infer<typeof SessionSchema>;

export const ProgramSchema = z
  .object({
    id: z.uuid(),
    user_id: z.uuid(),
    version: z.number().int().positive(),
    status: z.enum(['active', 'completed', 'archived']),
    program_mode: z.enum(['scheduled', 'unending']).default('scheduled'),
    total_weeks: z.number().int().positive().nullable(),
    unending_session_counter: z.number().int().min(0).default(0),
    training_days_per_week: z.number().int().min(1).max(7),
    start_date: z.iso.date(),
    created_at: z.iso.datetime({ offset: true }),
  })
  .strict();

export type Program = z.infer<typeof ProgramSchema>;

export const ProgramWithSessionsSchema = ProgramSchema.extend({
  sessions: z.array(SessionSchema),
});

export type ProgramWithSessions = z.infer<typeof ProgramWithSessionsSchema>;

export const CreateProgramSchema = z
  .object({
    lifter_maxes_id: z.uuid().optional(),
    formula_config_id: z.uuid().optional(),
    total_weeks: z.number().int().min(1).max(52),
    training_days_per_week: z.number().int().min(1).max(7),
    start_date: z.iso.date(),
  })
  .strict();

export type CreateProgram = z.infer<typeof CreateProgramSchema>;

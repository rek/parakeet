import { z } from 'zod'

export const LiftSchema = z.enum(['squat', 'bench', 'deadlift'])

export type Lift = z.infer<typeof LiftSchema>

export const IntensityTypeSchema = z.enum(['heavy', 'explosive', 'rep', 'deload'])

export type IntensityType = z.infer<typeof IntensityTypeSchema>

export const BlockNumberSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])

export type BlockNumber = z.infer<typeof BlockNumberSchema>

// weight_kg must be a positive multiple of 2.5 kg
const weightKgSchema = z
  .number()
  .positive()
  .refine((n) => Math.round(n * 10) % 25 === 0, {
    message: 'Weight must be a multiple of 2.5 kg',
  })

export const PlannedSetSchema = z
  .object({
    set_number: z.number().int().positive(),
    weight_kg: weightKgSchema,
    reps: z.number().int().positive(),
    rpe_target: z.number().min(6).max(10).optional(),
    reps_range: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
  })
  .strict()

export type PlannedSet = z.infer<typeof PlannedSetSchema>

export const SessionSchema = z
  .object({
    id: z.string().uuid(),
    program_id: z.string().uuid(),
    week_number: z.number().int().positive(),
    day_number: z.number().int().min(1).max(7),
    primary_lift: LiftSchema,
    intensity_type: IntensityTypeSchema,
    block_number: z.number().int().min(1).max(3).nullable(),
    is_deload: z.boolean(),
    planned_sets: z.array(PlannedSetSchema).nullable(),
    status: z.enum(['planned', 'in_progress', 'completed', 'skipped']),
    planned_date: z.string().date().nullable(),
  })
  .strict()

export type Session = z.infer<typeof SessionSchema>

export const ProgramSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    version: z.number().int().positive(),
    status: z.enum(['active', 'completed', 'archived']),
    total_weeks: z.number().int().positive(),
    training_days_per_week: z.number().int().min(1).max(7),
    start_date: z.string().date(),
    created_at: z.string().datetime(),
  })
  .strict()

export type Program = z.infer<typeof ProgramSchema>

export const ProgramWithSessionsSchema = ProgramSchema.extend({
  sessions: z.array(SessionSchema),
})

export type ProgramWithSessions = z.infer<typeof ProgramWithSessionsSchema>

export const CreateProgramSchema = z
  .object({
    lifter_maxes_id: z.string().uuid().optional(),
    formula_config_id: z.string().uuid().optional(),
    total_weeks: z.number().int().min(1).max(52),
    training_days_per_week: z.number().int().min(1).max(7),
    start_date: z.string().date(),
  })
  .strict()

export type CreateProgram = z.infer<typeof CreateProgramSchema>

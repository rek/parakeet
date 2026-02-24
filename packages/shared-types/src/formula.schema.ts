import { z } from 'zod'

const pct = z.number().min(0.40).max(1.05)
const rpeTarget = z
  .number()
  .min(5.0)
  .max(10.0)
  .refine((v) => Math.round(v * 2) === v * 2, { message: 'rpe_target must be a multiple of 0.5' })

export const FormulaBlockIntensitySchema = z
  .object({
    pct:        pct.optional(),
    sets:       z.number().int().min(1).max(10).optional(),
    reps:       z.number().int().min(1).max(20).optional(),
    rpe_target: rpeTarget.optional(),
  })
  .optional()

export const FormulaRepIntensitySchema = z
  .object({
    pct:       pct.optional(),
    sets_min:  z.number().int().min(1).max(10).optional(),
    sets_max:  z.number().int().min(1).max(10).optional(),
    reps_min:  z.number().int().min(1).max(20).optional(),
    reps_max:  z.number().int().min(1).max(20).optional(),
    rpe_target: rpeTarget.optional(),
  })
  .refine(
    (v) => {
      if (v.sets_min !== undefined && v.sets_max !== undefined) return v.sets_min <= v.sets_max
      if (v.reps_min !== undefined && v.reps_max !== undefined) return v.reps_min <= v.reps_max
      return true
    },
    { message: 'min values must be ≤ max values' },
  )
  .optional()

export const FormulaBlockSchema = z
  .object({
    heavy:    FormulaBlockIntensitySchema,
    explosive: FormulaBlockIntensitySchema,
    rep:      FormulaRepIntensitySchema,
  })
  .optional()

export const FormulaOverridesSchema = z.object({
  block1: FormulaBlockSchema,
  block2: FormulaBlockSchema,
  block3: FormulaBlockSchema,
  deload: z
    .object({
      pct:        z.number().min(0.20).max(0.60).optional(),
      sets:       z.number().int().min(1).max(5).optional(),
      reps:       z.number().int().min(1).max(15).optional(),
      rpe_target: rpeTarget.optional(),
    })
    .optional(),
  progressive_overload: z
    .object({
      heavy_pct_increment_per_block: z.number().min(0.025).max(0.10).optional(),
    })
    .optional(),
  training_max_increase: z
    .object({
      bench_min:    z.number().positive().optional(),
      bench_max:    z.number().positive().optional(),
      squat_min:    z.number().positive().optional(),
      squat_max:    z.number().positive().optional(),
      deadlift_min: z.number().positive().optional(),
      deadlift_max: z.number().positive().optional(),
    })
    .optional(),
})

export const CreateFormulaConfigSchema = z.object({
  overrides:     FormulaOverridesSchema,
  source:        z.enum(['user', 'ai_suggestion']),
  ai_rationale:  z.string().optional(),
})

export type CreateFormulaConfigInput = z.infer<typeof CreateFormulaConfigSchema>

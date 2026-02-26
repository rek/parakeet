import { z } from 'zod'

export const JITAdjustmentSchema = z.object({
  intensityModifier: z.number().min(0.40).max(1.20),
  setModifier: z.number().int().min(-3).max(2),
  skipMainLift: z.boolean(),
  auxOverrides: z.record(z.string(), z.enum(['skip', 'reduce', 'normal'])),
  rationale: z.array(z.string().max(200)).max(5),
  confidence: z.enum(['high', 'medium', 'low']),
  restAdjustments: z
    .object({
      mainLift: z.number().optional(), // delta seconds from formula default, [-60, +60] enforced post-parse
    })
    .optional(),
})

export type JITAdjustment = z.infer<typeof JITAdjustmentSchema>

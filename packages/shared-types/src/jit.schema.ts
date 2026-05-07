import { z } from 'zod';

// Per-exercise auxiliary override. Modeled as an array (not a record) because
// OpenAI's structured-output mode (Responses API, strict JSON schema) rejects
// `propertyNames` constraints, which is what zod emits for `z.record(z.string(), …)`.
export const AuxOverrideSchema = z.object({
  exercise: z.string(),
  action: z.enum(['skip', 'reduce', 'normal']),
});

export const JITAdjustmentSchema = z.object({
  intensityModifier: z.number().min(0.4).max(1.2),
  setModifier: z.number().int().min(-3).max(2),
  skipMainLift: z.boolean(),
  auxOverrides: z.array(AuxOverrideSchema),
  rationale: z.array(z.string().max(200)).max(5),
  confidence: z.enum(['high', 'medium', 'low']),
  restAdjustments: z
    .object({
      mainLift: z.number().optional(), // delta seconds from formula default, [-60, +60] enforced post-parse
    })
    .optional(),
});

export type JITAdjustment = z.infer<typeof JITAdjustmentSchema>;

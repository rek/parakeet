import { z } from 'zod';

// Per-exercise auxiliary override. Modeled as an array (not a record) because
// OpenAI's structured-output mode (Responses API, strict JSON schema) rejects
// `propertyNames` constraints, which is what zod emits for `z.record(z.string(), …)`.
//
// `anchorOverride` (GH#223) lets the LLM disagree with the engine-computed aux
// anchor for unusual contexts (recent injury, deload-after-PR). When non-null
// the engine uses `weightKg` as the aux base, stamps the carrier with
// `source='snap'` + `fromLLMOverride=true` + `rationale=reason`, and the
// hybrid divergence row records the (anchorWeightKg → llmOverrideWeightKg)
// delta. Bounded `[0, 500]` so a hallucinated weight cannot crash plate
// rounding. `.nullable()` not `.optional()` — same strict-schema rule as
// `restAdjustments` below.
export const AuxOverrideSchema = z.object({
  exercise: z.string(),
  action: z.enum(['skip', 'reduce', 'normal']),
  anchorOverride: z
    .object({
      weightKg: z.number().min(0).max(500),
      reason: z.string().max(160),
    })
    .nullable(),
});

// OpenAI structured-output strict mode requires every property listed in
// `properties` to also appear in `required`. Use `.nullable()` (not
// `.optional()`) so the schema stays strict-compatible while still allowing
// the model to omit a field by emitting `null`.
export const JITAdjustmentSchema = z.object({
  intensityModifier: z.number().min(0.4).max(1.2),
  setModifier: z.number().int().min(-3).max(2),
  skipMainLift: z.boolean(),
  auxOverrides: z.array(AuxOverrideSchema),
  rationale: z.array(z.string().max(200)).max(5),
  confidence: z.enum(['high', 'medium', 'low']),
  restAdjustments: z
    .object({
      mainLift: z.number().nullable(), // delta seconds from formula default, [-60, +60] enforced post-parse
    })
    .nullable(),
});

export type JITAdjustment = z.infer<typeof JITAdjustmentSchema>;

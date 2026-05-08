import { z } from 'zod';

import { AuxOverrideSchema } from './jit.schema';

// String maxLength is not enforced by OpenAI structured outputs, so we transform
// to truncate instead of reject. Hard reject would throw post-parse and discard
// the whole review for an over-length string. Truncation preserves the signal.
const truncateConcern = (s: string) =>
  s.length > 200 ? s.slice(0, 197) + '...' : s;

// DB columns for these scores are INTEGER. LLM occasionally returns 2.5;
// round to integer post-parse so we never hand a float to Postgres.
const roundScore = (n: number) => Math.round(n);

export const JudgeReviewSchema = z.object({
  score: z.number().min(0).max(100).transform(roundScore),
  verdict: z.enum(['accept', 'flag']),
  concerns: z.array(z.string().transform(truncateConcern)).max(3),
  // Strict-JSON-schema compatible: nullable instead of optional, so every
  // property remains in `required`. See note in jit.schema.ts.
  suggestedOverrides: z
    .object({
      intensityModifier: z.number().min(0.4).max(1.2).nullable(),
      setModifier: z.number().int().min(-3).max(2).nullable(),
      auxOverrides: z.array(AuxOverrideSchema).nullable(),
    })
    .nullable(),
});

export type JudgeReview = z.infer<typeof JudgeReviewSchema>;

const truncateInsight = (s: string) =>
  s.length > 200 ? s.slice(0, 197) + '...' : s;

export const DecisionReplaySchema = z.object({
  prescriptionScore: z.number().min(0).max(100).transform(roundScore),
  rpeAccuracy: z.number().min(0).max(100).transform(roundScore),
  volumeAppropriateness: z.enum(['too_much', 'right', 'too_little']),
  insights: z.array(z.string().transform(truncateInsight)).max(5),
});

export type DecisionReplay = z.infer<typeof DecisionReplaySchema>;

export const CalibrationReviewSchema = z.object({
  apply: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
  askUser: z.boolean(),
  reason: z.string().max(300),
});

export type CalibrationReview = z.infer<typeof CalibrationReviewSchema>;

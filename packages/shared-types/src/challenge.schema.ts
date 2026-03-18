import { z } from 'zod';

export const JudgeReviewSchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.enum(['accept', 'flag']),
  concerns: z.array(z.string().max(200)).max(3),
  suggestedOverrides: z
    .object({
      intensityModifier: z.number().min(0.4).max(1.2).optional(),
      setModifier: z.number().int().min(-3).max(2).optional(),
      auxOverrides: z
        .record(z.string(), z.enum(['skip', 'reduce', 'normal']))
        .optional(),
    })
    .optional(),
});

export type JudgeReview = z.infer<typeof JudgeReviewSchema>;

export const DecisionReplaySchema = z.object({
  prescriptionScore: z.number().min(0).max(100),
  rpeAccuracy: z.number().min(0).max(100),
  volumeAppropriateness: z.enum(['too_much', 'right', 'too_little']),
  insights: z.array(z.string().max(200)).max(5),
});

export type DecisionReplay = z.infer<typeof DecisionReplaySchema>;

export const CalibrationReviewSchema = z.object({
  apply: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
  askUser: z.boolean(),
  reason: z.string().max(300),
});

export type CalibrationReview = z.infer<typeof CalibrationReviewSchema>;

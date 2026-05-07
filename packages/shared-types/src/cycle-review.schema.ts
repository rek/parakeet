import { z } from 'zod';

const LiftRatingSchema = z.enum(['excellent', 'good', 'stalled', 'concerning']);

const LiftProgressSchema = z.object({
  rating: LiftRatingSchema,
  narrative: z.string(),
});

const CorrelatedExerciseSchema = z.object({
  exercise: z.string(),
  lift: z.string(),
  explanation: z.string(),
});

const RecommendedChangesSchema = z.object({
  add: z.array(z.string()),
  remove: z.array(z.string()),
  reorder: z.array(z.string()),
});

// `overrides` was a `z.record(z.string(), z.unknown())` describing the
// proposed parameter changes. OpenAI structured-output strict mode rejects
// `propertyNames` (which zod emits for record) AND open-ended `unknown`
// values (no schema), so the field was unrepresentable. The dashboard
// renderer doesn't consume it; downstream code stores the rationale string.
// Keep the human-readable fields and drop the structured one.
const FormulaSuggestionSchema = z.object({
  description: z.string(),
  rationale: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
});

const StructuralSuggestionSchema = z.object({
  description: z.string(),
  rationale: z.string(),
  developerNote: z.string(),
});

export const CycleReviewSchema = z.object({
  overallAssessment: z.string().max(500),
  progressByLift: z.object({
    squat: LiftProgressSchema,
    bench: LiftProgressSchema,
    deadlift: LiftProgressSchema,
  }),
  auxiliaryInsights: z.object({
    mostCorrelated: z.array(CorrelatedExerciseSchema),
    leastEffective: z.array(CorrelatedExerciseSchema),
    recommendedChanges: RecommendedChangesSchema,
  }),
  volumeInsights: z.object({
    musclesUnderRecovered: z.array(z.string()),
    musclesUndertrained: z.array(z.string()),
    frequencyRecommendation: z.string().nullable(),
  }),
  formulaSuggestions: z.array(FormulaSuggestionSchema),
  structuralSuggestions: z.array(StructuralSuggestionSchema),
  nextCycleRecommendations: z.string().max(2000),
  menstrualInsights: z.string().max(1000).nullable(),
});

export type CycleReview = z.infer<typeof CycleReviewSchema>;

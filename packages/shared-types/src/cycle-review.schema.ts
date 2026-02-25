import { z } from 'zod'

const LiftRatingSchema = z.enum(['excellent', 'good', 'stalled', 'concerning'])

const LiftProgressSchema = z.object({
  rating: LiftRatingSchema,
  narrative: z.string(),
})

const CorrelatedExerciseSchema = z.object({
  exercise: z.string(),
  lift: z.string(),
  explanation: z.string(),
})

const RecommendedChangesSchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
  reorder: z.array(z.string()).optional(),
})

const FormulaSuggestionSchema = z.object({
  description: z.string(),
  rationale: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  overrides: z.record(z.string(), z.unknown()),
})

const StructuralSuggestionSchema = z.object({
  description: z.string(),
  rationale: z.string(),
  developerNote: z.string(),
})

export const CycleReviewSchema = z.object({
  overallAssessment: z.string().max(500),
  progressByLift: z.record(
    z.enum(['squat', 'bench', 'deadlift']),
    LiftProgressSchema,
  ),
  auxiliaryInsights: z.object({
    mostCorrelated: z.array(CorrelatedExerciseSchema),
    leastEffective: z.array(CorrelatedExerciseSchema),
    recommendedChanges: RecommendedChangesSchema,
  }),
  volumeInsights: z.object({
    musclesUnderRecovered: z.array(z.string()),
    musclesUndertrained: z.array(z.string()),
    frequencyRecommendation: z.string().optional(),
  }),
  formulaSuggestions: z.array(FormulaSuggestionSchema),
  structuralSuggestions: z.array(StructuralSuggestionSchema),
  nextCycleRecommendations: z.string().max(2000),
  menstrualInsights: z.string().max(1000).optional(),
})

export type CycleReview = z.infer<typeof CycleReviewSchema>

import { z } from 'zod';

export const BarPathPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  frame: z.number().int(),
});

export type BarPathPoint = z.infer<typeof BarPathPointSchema>;

export const FormFaultSchema = z.object({
  type: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string(),
  value: z.number().optional(),
  threshold: z.number().optional(),
});

export type FormFault = z.infer<typeof FormFaultSchema>;

export const CriterionResultSchema = z.object({
  name: z.string(),
  verdict: z.enum(['pass', 'borderline', 'fail']),
  measured: z.number(),
  threshold: z.number(),
  unit: z.string(),
  message: z.string(),
});

export type CriterionResult = z.infer<typeof CriterionResultSchema>;

export const RepVerdictSchema = z.object({
  verdict: z.enum(['white_light', 'red_light', 'borderline']),
  criteria: z.array(CriterionResultSchema),
});

export type RepVerdict = z.infer<typeof RepVerdictSchema>;

export const RepAnalysisSchema = z.object({
  repNumber: z.number().int(),
  startFrame: z.number().int(),
  endFrame: z.number().int(),
  barPath: z.array(BarPathPointSchema),
  maxDepthCm: z.number().optional(),
  forwardLeanDeg: z.number().optional(),
  barDriftCm: z.number().optional(),
  romCm: z.number().optional(),
  kneeAngleDeg: z.number().optional(),
  hipAngleAtLockoutDeg: z.number().optional(),
  // Bar velocity (from wrist landmark Y displacement per frame)
  meanConcentricVelocityCmS: z.number().optional(),
  velocityLossPct: z.number().optional(),
  estimatedRir: z.number().optional(),
  // Tempo (concentric/eccentric phase durations)
  concentricDurationSec: z.number().optional(),
  eccentricDurationSec: z.number().optional(),
  tempoRatio: z.number().optional(),
  // Squat-specific
  buttWinkDeg: z.number().optional(),
  stanceWidthCm: z.number().optional(),
  hipShiftCm: z.number().optional(),
  hipShiftDirection: z.enum(['left', 'right', 'none']).optional(),
  // Bench-specific
  // `elbowFlareDeg` is preserved as the mean across the concentric (v4 wrote
  // a single-frame midpoint sample; v5+ writes the series mean). The series
  // fields below give the full distribution.
  elbowFlareDeg: z.number().optional(),
  elbowFlareMinDeg: z.number().optional(),
  elbowFlareMaxDeg: z.number().optional(),
  elbowFlareMeanDeg: z.number().optional(),
  pauseDurationSec: z.number().optional(),
  isSinking: z.boolean().optional(),
  // Bench, front-on only — populated when `sagittalConfidence < 0.5`.
  // `barTiltMaxDeg` is the worst tilt across the rep; mean is averaged
  // over the concentric. `pressAsymmetryRatio` is max(|L−R| wrist Y) /
  // torso length. `elbowPathSymmetryRatio` is (left elbow offset) /
  // (right elbow offset) from the shoulder midline — 1.0 = symmetric.
  barTiltMaxDeg: z.number().optional(),
  barTiltMeanDeg: z.number().optional(),
  pressAsymmetryRatio: z.number().optional(),
  elbowPathSymmetryRatio: z.number().optional(),
  // Deadlift-specific
  hipHingeCrossoverPct: z.number().optional(),
  barToShinDistanceCm: z.number().optional(),
  // All lifts
  lockoutStabilityCv: z.number().optional(),
  faults: z.array(FormFaultSchema),
  verdict: RepVerdictSchema.optional(),
});

export type RepAnalysis = z.infer<typeof RepAnalysisSchema>;

export const FatigueSignaturesSchema = z.object({
  forwardLeanDriftDeg: z.number().nullable(),
  barDriftIncreaseCm: z.number().nullable(),
  romCompressionCm: z.number().nullable(),
  descentSpeedChange: z.number().nullable(),
  lockoutDegradationDeg: z.number().nullable(),
  velocityLossTrend: z.enum(['increasing', 'stable', 'decreasing']).nullable(),
});

export type FatigueSignatures = z.infer<typeof FatigueSignaturesSchema>;

export const VideoAnalysisResultSchema = z.object({
  reps: z.array(RepAnalysisSchema),
  fps: z.number(),
  cameraAngle: z.enum(['side', 'front']).optional(),
  sagittalConfidence: z.number().min(0).max(1),
  analysisVersion: z.number().int(),
  fatigueSignatures: FatigueSignaturesSchema.optional(),
});

export type VideoAnalysisResult = z.infer<typeof VideoAnalysisResultSchema>;

// --- Form Coaching (LLM output) ---

export const FormCueSchema = z.object({
  repRange: z.string().max(20),
  observation: z.string().max(200),
  cue: z.string().max(200),
  priority: z.enum(['high', 'medium', 'low']),
});

export type FormCue = z.infer<typeof FormCueSchema>;

export const CompetitionReadinessAssessmentSchema = z.object({
  passRate: z.number().min(0).max(1),
  assessment: z.string().max(300),
  topConcern: z.string().max(200).nullable(),
});

export type CompetitionReadinessAssessment = z.infer<
  typeof CompetitionReadinessAssessmentSchema
>;

export const FormCoachingResultSchema = z.object({
  summary: z.string().max(500),
  repByRepBreakdown: z
    .array(
      z.object({
        repNumber: z.number().int(),
        assessment: z.string().max(300),
        formGrade: z.enum(['good', 'acceptable', 'needs_work']),
        competitionVerdict: z
          .enum(['white_light', 'red_light', 'borderline'])
          .nullable(),
      })
    )
    .max(10),
  cues: z.array(FormCueSchema).max(5),
  fatigueCorrelation: z.string().max(300).nullable(),
  comparedToBaseline: z.string().max(300).nullable(),
  competitionReadiness: CompetitionReadinessAssessmentSchema.nullable(),
  nextSessionSuggestion: z.string().max(300),
});

export type FormCoachingResult = z.infer<typeof FormCoachingResultSchema>;

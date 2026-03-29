import type { VideoAnalysisResult } from '@parakeet/shared-types';

/**
 * Training context assembled from session data for LLM form coaching.
 * This bridges video analysis metrics with the lifter's training state
 * so the LLM can correlate form issues with fatigue, soreness, and
 * programming context.
 */
export interface FormCoachingContext {
  // Video analysis metrics
  analysis: VideoAnalysisResult;
  lift: 'squat' | 'bench' | 'deadlift';

  // Session context
  weightKg: number | null;
  sessionRpe: number | null;
  blockNumber: number | null;
  weekNumber: number | null;
  intensityType: string | null;
  isDeload: boolean;

  // Body state at time of session
  sorenessRatings: Record<string, number> | null;
  sleepQuality: number | null;
  energyLevel: number | null;
  activeDisruptions: Array<{ disruption_type: string; severity: string }> | null;

  // Longitudinal context (from previous videos)
  previousVideoCount: number;
  averageBarDriftCm: number | null;
  averageDepthCm: number | null;
  averageForwardLeanDeg: number | null;
}

/**
 * Assemble coaching context from session detail + video analysis.
 *
 * Extracts the heaviest weight from actual sets for the primary lift,
 * and computes longitudinal averages from previous video analyses.
 */
export function assembleCoachingContext({
  analysis,
  lift,
  session,
  log,
  jitSnapshot,
  previousAnalyses,
}: {
  analysis: VideoAnalysisResult;
  lift: 'squat' | 'bench' | 'deadlift';
  session: {
    block_number: number | null;
    week_number: number | null;
    intensity_type: string | null;
    is_deload: boolean | null;
  } | null;
  log: {
    session_rpe: number | null;
    actual_sets: Array<{ weight_grams?: number; weight_kg?: number }>;
  } | null;
  jitSnapshot: {
    sorenessRatings?: Record<string, number>;
    sleepQuality?: number;
    energyLevel?: number;
    activeDisruptions?: Array<{ disruption_type: string; severity: string }>;
  } | null;
  previousAnalyses: VideoAnalysisResult[];
}) {
  // Extract heaviest weight from actual sets
  const maxWeightGrams = log?.actual_sets
    .map((s) => s.weight_grams ?? (s.weight_kg ?? 0) * 1000)
    .reduce((max, w) => Math.max(max, w), 0);
  const weightKg = maxWeightGrams ? maxWeightGrams / 1000 : null;

  // Compute longitudinal averages from previous analyses
  const prevWithReps = previousAnalyses.filter((a) => a.reps.length > 0);
  const allPrevReps = prevWithReps.flatMap((a) => a.reps);

  const averageBarDriftCm = allPrevReps.length > 0
    ? allPrevReps.reduce((sum, r) => sum + (r.barDriftCm ?? 0), 0) / allPrevReps.length
    : null;

  const depthReps = allPrevReps.filter((r) => r.maxDepthCm != null);
  const averageDepthCm = depthReps.length > 0
    ? depthReps.reduce((sum, r) => sum + r.maxDepthCm!, 0) / depthReps.length
    : null;

  const leanReps = allPrevReps.filter((r) => r.forwardLeanDeg != null);
  const averageForwardLeanDeg = leanReps.length > 0
    ? leanReps.reduce((sum, r) => sum + r.forwardLeanDeg!, 0) / leanReps.length
    : null;

  return {
    analysis,
    lift,
    weightKg,
    sessionRpe: log?.session_rpe ?? null,
    blockNumber: session?.block_number ?? null,
    weekNumber: session?.week_number ?? null,
    intensityType: session?.intensity_type ?? null,
    isDeload: session?.is_deload ?? false,
    sorenessRatings: jitSnapshot?.sorenessRatings ?? null,
    sleepQuality: jitSnapshot?.sleepQuality ?? null,
    energyLevel: jitSnapshot?.energyLevel ?? null,
    activeDisruptions: jitSnapshot?.activeDisruptions ?? null,
    previousVideoCount: prevWithReps.length,
    averageBarDriftCm,
    averageDepthCm,
    averageForwardLeanDeg,
  } satisfies FormCoachingContext;
}

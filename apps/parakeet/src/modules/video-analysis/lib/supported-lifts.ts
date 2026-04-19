// @spec docs/features/video-analysis/spec-pipeline.md
/**
 * Canonical list of lifts for which the video pipeline runs rep-level
 * analysis and form coaching. Anything else is recorded and stored but
 * not analysed at the rep level.
 *
 * Single source of truth — imported by both the orchestrator
 * (`application/reanalyze.ts`) and the lift-label classifier
 * (`lib/check-lift-mismatch.ts`) so the two cannot drift.
 */
export const SUPPORTED_LIFTS = ['squat', 'bench', 'deadlift'] as const;
export type SupportedLift = (typeof SUPPORTED_LIFTS)[number];

export function isSupportedLift(lift: string): lift is SupportedLift {
  return (SUPPORTED_LIFTS as readonly string[]).includes(lift);
}

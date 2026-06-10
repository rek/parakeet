// @spec docs/features/flock/spec-data-foundation.md

export type HeadlineKind = 'pr' | 'wilks' | 'streak' | 'trained';

/** View-model for one lifter's card on the Flock screen (kg, not grams). */
export interface FlockCard {
  userId: string;
  displayName: string;
  headline: string;
  headlineKind: HeadlineKind;
  prLift: string | null;
  prWeightKg: number | null;
  prReps: number | null;
  wilks: number | null;
  wilksDelta: number | null;
  streakWeeks: number | null;
  publishedAt: string;
}

/**
 * Producer-side payload to publish. Weight is in integer GRAMS at this
 * boundary (the projection stores grams); see `deriveHeadline`.
 */
export interface FlockHighlightInput {
  displayName: string;
  headline: string;
  headlineKind: HeadlineKind;
  latestPrLift: string | null;
  latestPrWeightG: number | null;
  latestPrReps: number | null;
  wilks: number | null;
  wilksDelta: number | null;
  streakWeeks: number | null;
}

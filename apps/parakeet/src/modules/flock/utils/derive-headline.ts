// @spec docs/features/flock/spec-publish.md
import { roundToNearest, weightKgToGrams } from '@shared/utils/weight';

import type { HeadlineKind } from '../model/flock.types';

/** Minimal PR shape consumed from `@modules/achievements` (engine-adapter `PR`). */
export interface HeadlinePR {
  type: 'estimated_1rm' | 'volume' | 'rep_at_weight';
  lift: string;
  value: number;
  weightKg?: number;
}

export interface HeadlineSignals {
  earnedPRs: HeadlinePR[];
  wilks: number | null;
  wilksDelta: number | null;
  streakWeeks: number | null;
}

export interface DerivedHeadline {
  headline: string;
  headlineKind: HeadlineKind;
  latestPrLift: string | null;
  latestPrWeightG: number | null;
  latestPrReps: number | null;
}

/** A streak is only headline-worthy once it's sustained. */
const STREAK_MILESTONE_WEEKS = 2;

const PR_RANK: Record<HeadlinePR['type'], number> = {
  estimated_1rm: 0,
  rep_at_weight: 1,
  volume: 2,
};

function liftLabel(lift: string): string {
  return lift.charAt(0).toUpperCase() + lift.slice(1);
}

function formatKg(kg: number): string {
  return `${roundToNearest(kg, 0.5)}kg`;
}

function pickBestPR(prs: HeadlinePR[]): HeadlinePR | null {
  if (prs.length === 0) return null;
  return [...prs].sort((a, b) => PR_RANK[a.type] - PR_RANK[b.type])[0];
}

function prHeadline(pr: HeadlinePR): DerivedHeadline {
  const lift = liftLabel(pr.lift);

  if (pr.type === 'rep_at_weight' && pr.weightKg !== undefined) {
    const reps = Math.round(pr.value);
    return {
      headline: `${lift} PR — ${formatKg(pr.weightKg)} × ${reps}`,
      headlineKind: 'pr',
      latestPrLift: pr.lift,
      latestPrWeightG: weightKgToGrams(roundToNearest(pr.weightKg, 0.5)),
      latestPrReps: reps,
    };
  }

  if (pr.type === 'estimated_1rm') {
    return {
      headline: `${lift} PR — e1RM ${formatKg(pr.value)}`,
      headlineKind: 'pr',
      latestPrLift: pr.lift,
      latestPrWeightG: weightKgToGrams(roundToNearest(pr.value, 0.5)),
      latestPrReps: null,
    };
  }

  // volume PR (or rep_at_weight without a weight — shouldn't happen)
  return {
    headline: `${lift} volume PR`,
    headlineKind: 'pr',
    latestPrLift: pr.lift,
    latestPrWeightG: null,
    latestPrReps: null,
  };
}

const NO_PR = {
  latestPrLift: null,
  latestPrWeightG: null,
  latestPrReps: null,
} as const;

/**
 * Picks the single best celebratory signal for a lifter's card.
 * Ranked: PR > positive Wilks change > sustained streak > "trained".
 * Pure — all formatting and grams conversion happen here.
 */
export function deriveHeadline(signals: HeadlineSignals): DerivedHeadline {
  const pr = pickBestPR(signals.earnedPRs);
  if (pr) return prHeadline(pr);

  if (
    signals.wilks !== null &&
    signals.wilksDelta !== null &&
    signals.wilksDelta > 0
  ) {
    return {
      headline: `Wilks ${signals.wilks} ▲ +${signals.wilksDelta}`,
      headlineKind: 'wilks',
      ...NO_PR,
    };
  }

  if (
    signals.streakWeeks !== null &&
    signals.streakWeeks >= STREAK_MILESTONE_WEEKS
  ) {
    return {
      headline: `${signals.streakWeeks}-week streak`,
      headlineKind: 'streak',
      ...NO_PR,
    };
  }

  return { headline: 'Trained today', headlineKind: 'trained', ...NO_PR };
}

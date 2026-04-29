import type { Lift, RecoverySnapshot } from '@parakeet/shared-types';

import { LIFTS } from '../auxiliary/exercise-catalog';

// ---------------------------------------------------------------------------
// Raw data shapes (Supabase rows passed in from the app layer)
// ---------------------------------------------------------------------------

export interface RawSession {
  id: string;
  week_number: number;
  block_number: number;
  primary_lift: string | null;
  intensity_type: string | null;
  status: string;
  planned_sets: unknown[] | null;
}

export interface RawSessionLog {
  session_id: string;
  session_rpe: number | null;
  actual_sets: unknown[] | null;
  completed_at: string;
}

export interface RawSorenessCheckin {
  muscle_group: string;
  soreness_level: number;
  checked_in_at: string;
}

export interface RawLifterMax {
  lift: string;
  one_rm_grams: number;
  recorded_at: string;
}

export interface RawDisruption {
  id: string;
  disruption_type: string;
  severity: 'minor' | 'moderate' | 'major';
  status: string;
  affected_lifts: string[] | null;
  reported_at: string;
}

export interface RawAuxiliaryAssignment {
  lift: string;
  block_number: number;
  exercises: string[];
}

export interface RawFormulaHistory {
  id: string;
  created_at: string;
  source: string;
  overrides: Record<string, unknown>;
}

export interface RawWeeklyBodyReviewMismatch {
  muscle: string;
  felt: number;
  predicted: number;
  direction: 'accumulating_fatigue' | 'recovering_well';
}

export interface RawWeeklyBodyReview {
  week_number: number;
  mismatches: RawWeeklyBodyReviewMismatch[];
  felt_soreness: Record<string, number>;
  predicted_fatigue: Record<string, { predicted: number; volumePct: number }>;
  created_at: string;
}

export interface RawCycleData {
  program: {
    id: string;
    total_weeks: number;
    start_date: string;
    status: string;
  };
  sessions: RawSession[];
  sessionLogs: RawSessionLog[];
  sorenessCheckins: RawSorenessCheckin[];
  lifterMaxes: RawLifterMax[];
  disruptions: RawDisruption[];
  auxiliaryAssignments: RawAuxiliaryAssignment[];
  formulaHistory: RawFormulaHistory[];
  /** Weekly body reviews submitted during this program (optional — omitted for ad-hoc) */
  weeklyBodyReviews?: RawWeeklyBodyReview[];
  /** Daily recovery snapshots covering the cycle's date range — optional */
  recoverySnapshots?: RecoverySnapshot[];
}

// ---------------------------------------------------------------------------
// CycleReport — the structured summary sent to the LLM
// ---------------------------------------------------------------------------

export interface LiftSummary {
  startOneRmKg: number;
  endOneRmKg: number;
  sessionCount: number;
  completedCount: number;
  avgRpeVsTarget: number | null;
  blockRpeTrends: Array<{
    block: number;
    avgRpe: number | null;
    targetRpe: number;
  }>;
}

export interface WeeklyVolumeRow {
  week: number;
  setsByMuscle: Record<string, number>;
  mrvPctByMuscle: Record<string, number>;
}

export interface AuxLiftCorrelation {
  exercise: string;
  lift: string;
  precedingWeeks: number;
  liftChangePct: number | null;
}

export interface RecoverySummary {
  /** Days with a snapshot row (signal coverage indicator) */
  dayCount: number;
  /** Mean readiness score across days with a non-null score, or null */
  avgReadinessScore: number | null;
  /** Mean HRV % change vs baseline across the cycle, or null */
  avgHrvPctChange: number | null;
  /** Mean RHR % change vs baseline across the cycle, or null */
  avgRhrPctChange: number | null;
  /** Mean sleep duration in minutes across days with sleep data, or null */
  avgSleepDurationMin: number | null;
  /** Date ranges (≥3 consecutive days) where avgReadinessScore < 50 — likely overreaching */
  lowReadinessStreaks: Array<{ start: string; end: string; avgScore: number }>;
  /** Up to 14 most recent snapshot rows for chart context */
  recent: RecoverySnapshot[];
}

export interface BodyReviewSummary {
  /** Total number of weekly body reviews submitted this cycle */
  reviewCount: number;
  /** Muscles with ≥2 accumulating_fatigue mismatches across the cycle's reviews */
  recurringAccumulatingMuscles: string[];
  /** Per-muscle average of (felt − predicted) across all reviews that included that muscle */
  avgFeltVsPredictedDelta: Record<string, number>;
}

export interface CycleReport {
  programId: string;
  totalWeeks: number;
  completionPct: number;
  lifts: Partial<Record<Lift, LiftSummary>>;
  weeklyVolume: WeeklyVolumeRow[];
  auxiliaryCorrelations: AuxLiftCorrelation[];
  disruptions: Array<{
    type: string;
    severity: string;
    affectedLifts: string[] | null;
    reportedAt: string;
  }>;
  formulaChanges: Array<{
    source: string;
    overrides: Record<string, unknown>;
    createdAt: string;
  }>;
  /** Body soreness review summary — null when no reviews were submitted */
  bodyReviewSummary: BodyReviewSummary | null;
  /** Recovery summary — null when no recovery snapshots exist for the cycle */
  recoverySummary: RecoverySummary | null;
}

// ---------------------------------------------------------------------------
// Assembly function
// ---------------------------------------------------------------------------

export function assembleCycleReport(raw: RawCycleData): CycleReport {
  const totalSessions = raw.sessions.length;
  const completedSessions = raw.sessions.filter(
    (s) => s.status === 'completed'
  ).length;
  const completionPct =
    totalSessions > 0 ? completedSessions / totalSessions : 0;

  // Per-lift summaries
  const lifts: Partial<Record<Lift, LiftSummary>> = {};
  for (const liftName of LIFTS) {
    const liftSessions = raw.sessions.filter(
      (s) => s.primary_lift === liftName
    );
    if (liftSessions.length === 0) continue;

    const maxes = raw.lifterMaxes
      .filter((m) => m.lift === liftName)
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

    const startOneRmKg = maxes[0] ? maxes[0].one_rm_grams / 1000 : 0;
    const endOneRmKg = maxes[maxes.length - 1]
      ? maxes[maxes.length - 1].one_rm_grams / 1000
      : 0;

    const liftLogs = raw.sessionLogs.filter((l) =>
      liftSessions.some((s) => s.id === l.session_id)
    );
    const rpeDiffs = liftLogs
      .filter((l) => l.session_rpe !== null)
      .map((l) => (l.session_rpe ?? 0) - 8.5); // 8.5 as default target RPE
    const avgRpeVsTarget =
      rpeDiffs.length > 0
        ? rpeDiffs.reduce((s, d) => s + d, 0) / rpeDiffs.length
        : null;

    const blockRpeTrends = [1, 2, 3].map((block) => {
      const blockSessions = liftSessions.filter(
        (s) => s.block_number === block
      );
      const blockLogs = raw.sessionLogs.filter((l) =>
        blockSessions.some(
          (s) => s.id === l.session_id && l.session_rpe !== null
        )
      );
      const blockRpes = blockLogs.map((l) => l.session_rpe ?? 0);
      return {
        block,
        avgRpe:
          blockRpes.length > 0
            ? blockRpes.reduce((s, r) => s + r, 0) / blockRpes.length
            : null,
        targetRpe: 8.5,
      };
    });

    lifts[liftName] = {
      startOneRmKg,
      endOneRmKg,
      sessionCount: liftSessions.length,
      completedCount: liftSessions.filter((s) => s.status === 'completed')
        .length,
      avgRpeVsTarget,
      blockRpeTrends,
    };
  }

  // Auxiliary correlations (simplified: map exercise → subsequent lift improvement)
  const auxiliaryCorrelations: AuxLiftCorrelation[] = [];
  for (const assignment of raw.auxiliaryAssignments) {
    for (const exercise of assignment.exercises) {
      const liftName = assignment.lift as Lift;
      const liftSummary = lifts[liftName];
      if (!liftSummary) continue;
      const changePct =
        liftSummary.startOneRmKg > 0
          ? ((liftSummary.endOneRmKg - liftSummary.startOneRmKg) /
              liftSummary.startOneRmKg) *
            100
          : null;
      auxiliaryCorrelations.push({
        exercise,
        lift: liftName,
        precedingWeeks: raw.program.total_weeks,
        liftChangePct: changePct,
      });
    }
  }

  // Weekly volume (simplified — set counts per week)
  const weeklyVolume: WeeklyVolumeRow[] = [];
  const weekNumbers = [...new Set(raw.sessions.map((s) => s.week_number))].sort(
    (a, b) => a - b
  );
  for (const week of weekNumbers) {
    const weekSessions = raw.sessions.filter((s) => s.week_number === week);
    const setsByMuscle: Record<string, number> = {};
    for (const session of weekSessions) {
      const sets = Array.isArray(session.planned_sets)
        ? session.planned_sets.length
        : 0;
      const lift = session.primary_lift;
      if (lift == null) continue;
      setsByMuscle[lift] = (setsByMuscle[lift] ?? 0) + sets;
    }
    weeklyVolume.push({ week, setsByMuscle, mrvPctByMuscle: {} });
  }

  // Weekly body review summary
  const bodyReviewSummary = assembleBodyReviewSummary(
    raw.weeklyBodyReviews ?? []
  );

  const recoverySummary = raw.recoverySnapshots
    ? buildRecoverySummary(raw.recoverySnapshots)
    : null;

  return {
    programId: raw.program.id,
    totalWeeks: raw.program.total_weeks,
    completionPct,
    lifts,
    weeklyVolume,
    auxiliaryCorrelations,
    disruptions: raw.disruptions.map((d) => ({
      type: d.disruption_type,
      severity: d.severity,
      affectedLifts: d.affected_lifts,
      reportedAt: d.reported_at,
    })),
    formulaChanges: raw.formulaHistory.map((f) => ({
      source: f.source,
      overrides: f.overrides,
      createdAt: f.created_at,
    })),
    bodyReviewSummary,
    recoverySummary,
  };
}

export function buildRecoverySummary(
  snapshots: RecoverySnapshot[]
): RecoverySummary | null {
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

  const mean = (xs: number[]): number | null =>
    xs.length === 0
      ? null
      : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

  const scores = sorted
    .map((s) => s.readiness_score)
    .filter((v): v is number => v !== null);
  const hrvChanges = sorted
    .map((s) => s.hrv_pct_change)
    .filter((v): v is number => v !== null);
  const rhrChanges = sorted
    .map((s) => s.rhr_pct_change)
    .filter((v): v is number => v !== null);
  const sleepDur = sorted
    .map((s) => s.sleep_duration_min)
    .filter((v): v is number => v !== null);

  // Identify ≥3 consecutive days with score < 50
  const lowStreaks: RecoverySummary['lowReadinessStreaks'] = [];
  let runStart = -1;
  let runScores: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const score = sorted[i].readiness_score;
    const isLow = score !== null && score < 50;
    if (isLow) {
      if (runStart < 0) runStart = i;
      runScores.push(score);
    }
    if ((!isLow || i === sorted.length - 1) && runStart >= 0) {
      const runEnd = isLow ? i : i - 1;
      if (runEnd - runStart + 1 >= 3) {
        lowStreaks.push({
          start: sorted[runStart].date,
          end: sorted[runEnd].date,
          avgScore: mean(runScores)!,
        });
      }
      runStart = -1;
      runScores = [];
    }
  }

  return {
    dayCount: sorted.length,
    avgReadinessScore: mean(scores),
    avgHrvPctChange: mean(hrvChanges),
    avgRhrPctChange: mean(rhrChanges),
    avgSleepDurationMin: mean(sleepDur),
    lowReadinessStreaks: lowStreaks,
    recent: sorted.slice(-14),
  };
}

/**
 * Summarise weekly body review data for inclusion in the LLM cycle report.
 * Returns null when no reviews exist.
 */
export function assembleBodyReviewSummary(
  reviews: RawWeeklyBodyReview[]
): BodyReviewSummary | null {
  if (reviews.length === 0) return null;

  // Count accumulating_fatigue mismatches per muscle across all reviews
  const accumulatingCounts: Record<string, number> = {};
  // Accumulate (felt − predicted) sums and counts per muscle for delta averages
  const deltaSums: Record<string, number> = {};
  const deltaCounts: Record<string, number> = {};

  for (const review of reviews) {
    for (const mismatch of review.mismatches) {
      if (mismatch.direction === 'accumulating_fatigue') {
        accumulatingCounts[mismatch.muscle] =
          (accumulatingCounts[mismatch.muscle] ?? 0) + 1;
      }
    }

    for (const [muscle, felt] of Object.entries(review.felt_soreness)) {
      const predictedEntry = review.predicted_fatigue[muscle];
      if (predictedEntry == null) continue;
      const delta = felt - predictedEntry.predicted;
      deltaSums[muscle] = (deltaSums[muscle] ?? 0) + delta;
      deltaCounts[muscle] = (deltaCounts[muscle] ?? 0) + 1;
    }
  }

  const recurringAccumulatingMuscles = Object.entries(accumulatingCounts)
    .filter(([, count]) => count >= 2)
    .map(([muscle]) => muscle)
    .sort();

  const avgFeltVsPredictedDelta: Record<string, number> = {};
  for (const [muscle, sum] of Object.entries(deltaSums)) {
    const count = deltaCounts[muscle] ?? 1;
    avgFeltVsPredictedDelta[muscle] = Math.round((sum / count) * 10) / 10;
  }

  return {
    reviewCount: reviews.length,
    recurringAccumulatingMuscles,
    avgFeltVsPredictedDelta,
  };
}

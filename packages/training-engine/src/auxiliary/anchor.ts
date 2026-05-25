// @spec docs/features/auxiliary-exercises/spec-history-anchored-weight.md
/**
 * History-anchored auxiliary weight (GH#221).
 *
 * Replaces the static `oneRmKg × catalog.weightPct` base with a rolling
 * average of the lifter's own recent completed sessions of the same aux
 * exercise. Pure: no I/O, no dates beyond what callers pass in.
 *
 * See docs/features/auxiliary-exercises/design-history-anchored-weight.md
 * for the decisions table that governs every constant here.
 */

/** Window of completed sessions feeding the rolling-average anchor. */
export const ANCHOR_WINDOW_SIZE = 3;

/** Days since the most-recent session before the anchor starts decaying
 *  back toward the formula. 8 weeks survives a normal block + deload. */
export const ANCHOR_RECENCY_HORIZON_DAYS = 56;

/** Beyond the horizon, the anchor lerps linearly to formula over this
 *  many additional days. At horizon + DECAY_DAYS the anchor is gone. */
export const ANCHOR_DECAY_DAYS = 28;

/** Snap rule: two consecutive overrides must agree within this fraction
 *  of each other (top-set weight) to trigger an anchor snap. */
export const ANCHOR_SNAP_TOLERANCE = 0.05;

/** Snap rule: an override is detected when actual top-set weight differs
 *  from the session's prescribed weight by at least this fraction. */
export const ANCHOR_OVERRIDE_MIN_DELTA = 0.02;

/** One completed session's contribution to the rolling average. */
export interface AuxHistoryEntry {
  sessionId: string;
  /** ISO timestamp of session completion. */
  completedAt: string;
  /** The weight JIT prescribed for this aux exercise on this session.
   *  Pulled from jit_output_jsonb. May be null for legacy sessions where
   *  the prescribed weight cannot be recovered — snap detection is
   *  inhibited for these entries. */
  prescribedWeightKg: number | null;
  sets: Array<{ weightKg: number; reps: number; rpe?: number }>;
}

export type AuxAnchorSource = 'formula' | 'blend' | 'history' | 'snap';

export type AuxAnchorConfidence =
  | 'exploring'
  | 'low'
  | 'medium'
  | 'high';

export interface AuxAnchorResult {
  /** Final anchor weight in kg, before plate rounding. Caller rounds. */
  anchorKg: number;
  source: AuxAnchorSource;
  /** Number of history entries that contributed. 0 means pure formula. */
  sessionsUsed: number;
  confidence: AuxAnchorConfidence;
  /** What the formula alone would have produced. Always populated so the
   *  UI can compute the divergence callout. */
  formulaWeightKg: number;
  snapDetected: boolean;
  /** True when the stale-window decay reduced the anchor. */
  decayApplied: boolean;
  /** Short, user-facing string for the explainer sheet. */
  rationale: string;
}

/**
 * Public carrier of anchor metadata for downstream consumers (the UI's
 * `AuxiliaryWork.anchor`, the trace's `AuxAnchorTrace`). Derived from
 * `AuxAnchorResult` so the shapes can't drift. Drops `snapDetected` and
 * `decayApplied` (internal decision flags consumers don't act on) and
 * renames `anchorKg` → `anchorBaseKg` to make the pre-modifier semantics
 * explicit — UI rows would otherwise confuse it with the post-modifier
 * prescribed weight on the same row.
 */
export type AuxAnchorCarrier = Pick<
  AuxAnchorResult,
  'source' | 'confidence' | 'formulaWeightKg' | 'sessionsUsed' | 'rationale'
> & {
  /** Pre-modifier anchor weight (the engine's `AuxAnchorResult.anchorKg`,
   *  renamed here so callers don't mistake it for the post-modifier
   *  prescribed weight on the same row). */
  anchorBaseKg: number;
};

/** Helper for constructing a carrier from an `AuxAnchorResult`. Centralised
 *  here so every site that lifts a result into a carrier picks up the same
 *  field set automatically. */
export function toAnchorCarrier(result: AuxAnchorResult): AuxAnchorCarrier {
  return {
    source: result.source,
    confidence: result.confidence,
    formulaWeightKg: result.formulaWeightKg,
    sessionsUsed: result.sessionsUsed,
    rationale: result.rationale,
    anchorBaseKg: result.anchorKg,
  };
}

export interface AuxAnchorInput {
  formulaWeightKg: number;
  /** Newest-first. Each entry is one completed session. */
  history: AuxHistoryEntry[];
  /** Current time (ISO). Pure: caller passes it in. */
  nowIso: string;
}

/** Heaviest set logged in a session. The lifter's intent signal. */
function topSetWeight(entry: AuxHistoryEntry): number {
  let max = 0;
  for (const s of entry.sets) {
    if (s.weightKg > max) max = s.weightKg;
  }
  return max;
}

/** Direction of an override against its prescribed weight. */
type OverrideDirection = 'above' | 'below' | 'none';

function overrideDirection(entry: AuxHistoryEntry): OverrideDirection {
  if (entry.prescribedWeightKg == null || entry.prescribedWeightKg <= 0) {
    return 'none';
  }
  const top = topSetWeight(entry);
  if (top <= 0) return 'none';
  const delta = (top - entry.prescribedWeightKg) / entry.prescribedWeightKg;
  if (delta > ANCHOR_OVERRIDE_MIN_DELTA) return 'above';
  if (delta < -ANCHOR_OVERRIDE_MIN_DELTA) return 'below';
  return 'none';
}

/**
 * True when the two most-recent sessions both have top-set weight that
 * deviates from prescribed in the same direction (both above or both
 * below) AND the two override weights are within ANCHOR_SNAP_TOLERANCE
 * of each other. Honors the user's "I told you twice" signal.
 */
export function detectSnap(history: AuxHistoryEntry[]): boolean {
  if (history.length < 2) return false;
  const [a, b] = history;
  const dirA = overrideDirection(a);
  const dirB = overrideDirection(b);
  if (dirA === 'none' || dirB === 'none') return false;
  if (dirA !== dirB) return false;
  const topA = topSetWeight(a);
  const topB = topSetWeight(b);
  if (topA <= 0 || topB <= 0) return false;
  const larger = Math.max(topA, topB);
  const smaller = Math.min(topA, topB);
  return (larger - smaller) / larger <= ANCHOR_SNAP_TOLERANCE;
}

/**
 * Linear 0 → 1 over sessions 0..ANCHOR_WINDOW_SIZE. At sessionCount = 0
 * the formula dominates; at sessionCount >= ANCHOR_WINDOW_SIZE history
 * dominates entirely.
 */
export function computeBlendFactor(sessionCount: number): number {
  if (sessionCount <= 0) return 0;
  if (sessionCount >= ANCHOR_WINDOW_SIZE) return 1;
  return sessionCount / ANCHOR_WINDOW_SIZE;
}

/**
 * Multiplier in [0, 1] for how much weight history retains relative to
 * the recency horizon. 1.0 when the most-recent session is within the
 * horizon; lerps to 0 over ANCHOR_DECAY_DAYS days beyond.
 */
export function computeStaleDecay({
  history,
  nowIso,
  horizonDays = ANCHOR_RECENCY_HORIZON_DAYS,
  decayDays = ANCHOR_DECAY_DAYS,
}: {
  history: AuxHistoryEntry[];
  nowIso: string;
  horizonDays?: number;
  decayDays?: number;
}): number {
  if (history.length === 0) return 0;
  const mostRecent = history[0];
  const recentMs = Date.parse(mostRecent.completedAt);
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(recentMs) || Number.isNaN(nowMs)) return 1;
  const ageDays = Math.max(0, (nowMs - recentMs) / (1000 * 60 * 60 * 24));
  if (ageDays <= horizonDays) return 1;
  const overshoot = ageDays - horizonDays;
  if (overshoot >= decayDays) return 0;
  return 1 - overshoot / decayDays;
}

export function confidenceFor(
  sessionCount: number,
  snapDetected: boolean
): AuxAnchorConfidence {
  if (snapDetected) return 'high';
  if (sessionCount <= 0) return 'exploring';
  if (sessionCount < 3) return 'low';
  if (sessionCount < 6) return 'medium';
  return 'high';
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Compute the working anchor for one aux exercise.
 *
 * Decision tree:
 *   1. Snap rule (last two sessions, consistent override direction, close
 *      magnitudes) → anchor = max of the two override top sets.
 *   2. >= ANCHOR_WINDOW_SIZE sessions → pure history average of top sets.
 *   3. 1..ANCHOR_WINDOW_SIZE-1 sessions → blend formula and history.
 *   4. No history → formula passthrough.
 *
 * Then apply stale-window decay (lerp anchor back to formula if the
 * most-recent session is past the recency horizon).
 *
 * Modifiers (post-main fatigue, soreness, disruption, MRV) are applied
 * by the caller — this function only produces the BASE anchor.
 */
export function computeAuxAnchor(input: AuxAnchorInput): AuxAnchorResult {
  const { formulaWeightKg, history, nowIso } = input;
  const trimmed = history.slice(0, ANCHOR_WINDOW_SIZE);
  const sessionCount = trimmed.length;

  if (sessionCount === 0) {
    return {
      anchorKg: formulaWeightKg,
      source: 'formula',
      sessionsUsed: 0,
      confidence: 'exploring',
      formulaWeightKg,
      snapDetected: false,
      decayApplied: false,
      rationale: 'No prior history — starting from the catalog formula.',
    };
  }

  const snap = detectSnap(trimmed);
  let anchorKg: number;
  let source: AuxAnchorSource;
  let rationale: string;

  if (snap) {
    const topA = topSetWeight(trimmed[0]);
    const topB = topSetWeight(trimmed[1]);
    anchorKg = Math.max(topA, topB);
    source = 'snap';
    rationale =
      'You adjusted the prescribed weight in the same direction two sessions in a row — we adopted your number.';
  } else {
    const topSets = trimmed.map(topSetWeight).filter((w) => w > 0);
    const historyAvg = average(topSets);
    if (sessionCount >= ANCHOR_WINDOW_SIZE && historyAvg > 0) {
      anchorKg = historyAvg;
      source = 'history';
      rationale = `Average top set across your last ${sessionCount} sessions.`;
    } else if (historyAvg > 0) {
      const blendFactor = computeBlendFactor(sessionCount);
      anchorKg = lerp(formulaWeightKg, historyAvg, blendFactor);
      source = 'blend';
      rationale = `Blending the catalog formula with your last ${sessionCount} session${sessionCount === 1 ? '' : 's'}.`;
    } else {
      anchorKg = formulaWeightKg;
      source = 'formula';
      rationale = 'Recent sessions had no usable weight — using the catalog formula.';
    }
  }

  const decay = computeStaleDecay({ history: trimmed, nowIso });
  const decayApplied = decay < 1 && source !== 'snap';
  let effectiveSessionCount = sessionCount;
  if (decayApplied) {
    anchorKg = lerp(formulaWeightKg, anchorKg, decay);
    rationale +=
      decay === 0
        ? ' History is stale (no recent session) — fell back to the formula.'
        : ' History is partially stale — anchor pulled toward the formula.';
    if (decay === 0) {
      // Full decay → the result is indistinguishable from a cold-start
      // formula prescription. Also zero out the pedigree fields so that
      // downstream consumers (e.g. AuxAnchorTrace → post-session
      // calibration) don't read `confidence: 'medium'` from sessions that
      // contributed nothing.
      source = 'formula';
      effectiveSessionCount = 0;
    }
  }

  return {
    anchorKg,
    source,
    sessionsUsed: effectiveSessionCount,
    confidence: confidenceFor(effectiveSessionCount, snap),
    formulaWeightKg,
    snapDetected: snap,
    decayApplied,
    rationale,
  };
}

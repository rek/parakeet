import { describe, expect, it } from 'vitest';

import {
  ANCHOR_DECAY_DAYS,
  ANCHOR_RECENCY_HORIZON_DAYS,
  ANCHOR_WINDOW_SIZE,
  AuxHistoryEntry,
  computeAuxAnchor,
  computeBlendFactor,
  computeStaleDecay,
  confidenceFor,
  detectSnap,
} from './anchor';

const NOW = '2026-05-23T12:00:00Z';

function daysAgo(days: number): string {
  return new Date(Date.parse(NOW) - days * 24 * 60 * 60 * 1000).toISOString();
}

function entry(opts: {
  prescribed: number | null;
  topSet: number;
  ageDays?: number;
  sessionId?: string;
}): AuxHistoryEntry {
  return {
    sessionId: opts.sessionId ?? `sess-${Math.random().toString(36).slice(2)}`,
    completedAt: daysAgo(opts.ageDays ?? 0),
    prescribedWeightKg: opts.prescribed,
    sets: [{ weightKg: opts.topSet, reps: 8 }],
  };
}

describe('computeBlendFactor', () => {
  it('returns 0 for no sessions', () => {
    expect(computeBlendFactor(0)).toBe(0);
  });
  it('returns 1/3 at 1 session', () => {
    expect(computeBlendFactor(1)).toBeCloseTo(1 / 3);
  });
  it('returns 2/3 at 2 sessions', () => {
    expect(computeBlendFactor(2)).toBeCloseTo(2 / 3);
  });
  it('returns 1 at full window', () => {
    expect(computeBlendFactor(ANCHOR_WINDOW_SIZE)).toBe(1);
  });
  it('caps at 1 beyond the window', () => {
    expect(computeBlendFactor(99)).toBe(1);
  });
});

describe('confidenceFor', () => {
  it('snap always promotes to high', () => {
    expect(confidenceFor(0, true)).toBe('high');
    expect(confidenceFor(1, true)).toBe('high');
  });
  it('0 sessions → exploring', () => {
    expect(confidenceFor(0, false)).toBe('exploring');
  });
  it('1-2 sessions → low', () => {
    expect(confidenceFor(1, false)).toBe('low');
    expect(confidenceFor(2, false)).toBe('low');
  });
  it('3-5 sessions → medium', () => {
    expect(confidenceFor(3, false)).toBe('medium');
    expect(confidenceFor(5, false)).toBe('medium');
  });
  it('6+ sessions → high', () => {
    expect(confidenceFor(6, false)).toBe('high');
    expect(confidenceFor(99, false)).toBe('high');
  });
});

describe('detectSnap', () => {
  it('returns false with < 2 sessions', () => {
    expect(detectSnap([])).toBe(false);
    expect(detectSnap([entry({ prescribed: 80, topSet: 90 })])).toBe(false);
  });

  it('detects two consecutive above-prescribed within 5%', () => {
    const history = [
      entry({ prescribed: 80, topSet: 90 }), // +12.5%
      entry({ prescribed: 80, topSet: 92.5 }), // +15.6%, within 2.8% of 90
    ];
    expect(detectSnap(history)).toBe(true);
  });

  it('detects two consecutive below-prescribed within 5%', () => {
    const history = [
      entry({ prescribed: 100, topSet: 80 }),
      entry({ prescribed: 100, topSet: 78 }),
    ];
    expect(detectSnap(history)).toBe(true);
  });

  it('rejects mixed directions', () => {
    const history = [
      entry({ prescribed: 80, topSet: 90 }),
      entry({ prescribed: 80, topSet: 70 }),
    ];
    expect(detectSnap(history)).toBe(false);
  });

  it('rejects when one session is within the no-override band', () => {
    const history = [
      entry({ prescribed: 80, topSet: 90 }),
      entry({ prescribed: 80, topSet: 80.5 }), // < 2% delta = no override
    ];
    expect(detectSnap(history)).toBe(false);
  });

  it('rejects when magnitudes diverge by > 5%', () => {
    const history = [
      entry({ prescribed: 80, topSet: 90 }),
      entry({ prescribed: 80, topSet: 100 }), // 11% apart from 90
    ];
    expect(detectSnap(history)).toBe(false);
  });

  it('rejects when prescribed weight is missing (legacy session)', () => {
    const history = [
      entry({ prescribed: null, topSet: 90 }),
      entry({ prescribed: 80, topSet: 92 }),
    ];
    expect(detectSnap(history)).toBe(false);
  });
});

describe('computeStaleDecay', () => {
  it('returns 0 for empty history', () => {
    expect(computeStaleDecay({ history: [], nowIso: NOW })).toBe(0);
  });

  it('returns 1 within the horizon', () => {
    const history = [entry({ prescribed: 80, topSet: 90, ageDays: 10 })];
    expect(computeStaleDecay({ history, nowIso: NOW })).toBe(1);
  });

  it('returns 1 exactly at the horizon', () => {
    const history = [
      entry({
        prescribed: 80,
        topSet: 90,
        ageDays: ANCHOR_RECENCY_HORIZON_DAYS,
      }),
    ];
    expect(computeStaleDecay({ history, nowIso: NOW })).toBe(1);
  });

  it('partial decay within the decay window', () => {
    const history = [
      entry({
        prescribed: 80,
        topSet: 90,
        ageDays: ANCHOR_RECENCY_HORIZON_DAYS + ANCHOR_DECAY_DAYS / 2,
      }),
    ];
    expect(computeStaleDecay({ history, nowIso: NOW })).toBeCloseTo(0.5);
  });

  it('returns 0 past the decay window', () => {
    const history = [
      entry({
        prescribed: 80,
        topSet: 90,
        ageDays: ANCHOR_RECENCY_HORIZON_DAYS + ANCHOR_DECAY_DAYS + 1,
      }),
    ];
    expect(computeStaleDecay({ history, nowIso: NOW })).toBe(0);
  });
});

describe('computeAuxAnchor', () => {
  it('no history → formula passthrough, exploring confidence', () => {
    const result = computeAuxAnchor({
      formulaWeightKg: 75,
      history: [],
      nowIso: NOW,
    });
    expect(result.anchorKg).toBe(75);
    expect(result.source).toBe('formula');
    expect(result.confidence).toBe('exploring');
    expect(result.sessionsUsed).toBe(0);
    expect(result.formulaWeightKg).toBe(75);
  });

  it('1 session → blend at 1/3 toward history', () => {
    const history = [entry({ prescribed: 75, topSet: 90, ageDays: 3 })];
    const result = computeAuxAnchor({
      formulaWeightKg: 75,
      history,
      nowIso: NOW,
    });
    expect(result.source).toBe('blend');
    expect(result.sessionsUsed).toBe(1);
    expect(result.confidence).toBe('low');
    // formula 75 + 1/3 of (90 - 75) = 80
    expect(result.anchorKg).toBeCloseTo(80);
  });

  it('2 sessions → blend at 2/3 toward history (when no snap)', () => {
    const history = [
      // Both above prescribed by ~4%, but not in same band → no snap
      entry({ prescribed: 75, topSet: 78, ageDays: 3 }),
      entry({ prescribed: 75, topSet: 90, ageDays: 10 }), // 18% apart → no snap
    ];
    const result = computeAuxAnchor({
      formulaWeightKg: 75,
      history,
      nowIso: NOW,
    });
    expect(result.source).toBe('blend');
    expect(result.sessionsUsed).toBe(2);
    expect(result.confidence).toBe('low');
    // avg of top sets = 84; formula 75 + 2/3 * (84 - 75) = 81
    expect(result.anchorKg).toBeCloseTo(81);
  });

  it('3 sessions → pure history average', () => {
    const history = [
      entry({ prescribed: 75, topSet: 80, ageDays: 3 }),
      entry({ prescribed: 75, topSet: 85, ageDays: 10 }),
      entry({ prescribed: 75, topSet: 90, ageDays: 17 }),
    ];
    const result = computeAuxAnchor({
      formulaWeightKg: 75,
      history,
      nowIso: NOW,
    });
    expect(result.source).toBe('history');
    expect(result.sessionsUsed).toBe(3);
    expect(result.confidence).toBe('medium');
    expect(result.anchorKg).toBeCloseTo(85);
  });

  it('snap rule: two consecutive above-prescribed within 5% → snap to max', () => {
    const history = [
      entry({ prescribed: 80, topSet: 92, ageDays: 3 }),
      entry({ prescribed: 80, topSet: 90, ageDays: 10 }),
      entry({ prescribed: 80, topSet: 80, ageDays: 17 }),
    ];
    const result = computeAuxAnchor({
      formulaWeightKg: 80,
      history,
      nowIso: NOW,
    });
    expect(result.source).toBe('snap');
    expect(result.snapDetected).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.anchorKg).toBe(92);
  });

  it('window cap: only first 3 sessions considered', () => {
    const history = [
      entry({ prescribed: 75, topSet: 100, ageDays: 3 }),
      entry({ prescribed: 75, topSet: 100, ageDays: 10 }),
      entry({ prescribed: 75, topSet: 100, ageDays: 17 }),
      entry({ prescribed: 75, topSet: 50, ageDays: 24 }), // ignored
      entry({ prescribed: 75, topSet: 50, ageDays: 31 }), // ignored
    ];
    const result = computeAuxAnchor({
      formulaWeightKg: 75,
      history,
      nowIso: NOW,
    });
    expect(result.anchorKg).toBeCloseTo(100);
    expect(result.sessionsUsed).toBe(3);
  });

  it('stale window: 9 weeks ago → partial decay applied', () => {
    // Use prescribed = topSet so no override → no snap interference
    const history = [
      entry({ prescribed: 90, topSet: 90, ageDays: 63 }),
      entry({ prescribed: 90, topSet: 90, ageDays: 70 }),
      entry({ prescribed: 90, topSet: 90, ageDays: 77 }),
    ];
    const result = computeAuxAnchor({
      formulaWeightKg: 75,
      history,
      nowIso: NOW,
    });
    expect(result.decayApplied).toBe(true);
    // decay = 1 - 7/28 = 0.75 → anchor lerp(75, 90, 0.75) = 86.25
    expect(result.anchorKg).toBeCloseTo(86.25);
  });

  it('fully stale: > 12 weeks ago → reverts to formula', () => {
    const history = [
      entry({ prescribed: 100, topSet: 100, ageDays: 90 }),
      entry({ prescribed: 100, topSet: 100, ageDays: 97 }),
      entry({ prescribed: 100, topSet: 100, ageDays: 104 }),
    ];
    const result = computeAuxAnchor({
      formulaWeightKg: 75,
      history,
      nowIso: NOW,
    });
    expect(result.decayApplied).toBe(true);
    expect(result.anchorKg).toBe(75);
    expect(result.source).toBe('formula');
    // Full decay must also zero out the pedigree fields: a formula result
    // claiming `confidence: 'medium'` + `sessionsUsed: 3` would mislead the
    // post-session calibration trace into thinking history backed the
    // prescription when it didn't.
    expect(result.confidence).toBe('exploring');
    expect(result.sessionsUsed).toBe(0);
  });

  it('snap takes precedence over stale decay (bypasses decay entirely)', () => {
    // Both entries are well past the 56-day recency horizon — decay would
    // normally lerp the anchor toward the formula. Snap must bypass that
    // and return the unmodified override max. If we accidentally let decay
    // apply on snap, the assertion on `anchorKg === 92` would fail.
    const history = [
      entry({ prescribed: 80, topSet: 92, ageDays: 70 }),
      entry({ prescribed: 80, topSet: 90, ageDays: 77 }),
    ];
    const result = computeAuxAnchor({
      formulaWeightKg: 80,
      history,
      nowIso: NOW,
    });
    expect(result.source).toBe('snap');
    expect(result.decayApplied).toBe(false);
    expect(result.anchorKg).toBe(92);
  });

  it('top-set selection picks the heaviest set, not the last', () => {
    const history: AuxHistoryEntry[] = [
      {
        sessionId: 's1',
        completedAt: daysAgo(3),
        prescribedWeightKg: 75,
        sets: [
          { weightKg: 70, reps: 10 },
          { weightKg: 100, reps: 5 }, // heaviest — should drive anchor
          { weightKg: 80, reps: 8 },
        ],
      },
      {
        sessionId: 's2',
        completedAt: daysAgo(10),
        prescribedWeightKg: 75,
        sets: [{ weightKg: 100, reps: 5 }],
      },
      {
        sessionId: 's3',
        completedAt: daysAgo(17),
        prescribedWeightKg: 75,
        sets: [{ weightKg: 100, reps: 5 }],
      },
    ];
    const result = computeAuxAnchor({
      formulaWeightKg: 75,
      history,
      nowIso: NOW,
    });
    expect(result.anchorKg).toBeCloseTo(100);
  });

  it('legacy entries with null prescribed weight do not trigger snap', () => {
    const history = [
      entry({ prescribed: null, topSet: 95, ageDays: 3 }),
      entry({ prescribed: null, topSet: 92, ageDays: 10 }),
      entry({ prescribed: null, topSet: 90, ageDays: 17 }),
    ];
    const result = computeAuxAnchor({
      formulaWeightKg: 75,
      history,
      nowIso: NOW,
    });
    expect(result.source).toBe('history');
    expect(result.snapDetected).toBe(false);
  });
});

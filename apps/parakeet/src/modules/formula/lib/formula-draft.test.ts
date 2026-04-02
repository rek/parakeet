import type {
  BlockIntensityConfig,
  FormulaConfig,
  RepIntensityConfig,
} from '@parakeet/training-engine';
import { describe, expect, it } from 'vitest';

import {
  draftToOverrides,
  exampleWeight,
  initDraft,
  toRowDraft,
} from './formula-draft';
import type { DraftConfig, RowDraft } from './formula-draft';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BLOCK_ROW: BlockIntensityConfig = {
  pct: 0.8,
  sets: 3,
  reps: 5,
  rpe_target: 8,
};

const BLOCK_ROW_WITH_REPS_MAX: BlockIntensityConfig = {
  pct: 0.75,
  sets: 4,
  reps: 3,
  reps_max: 5,
  rpe_target: 7.5,
};

const REP_ROW: RepIntensityConfig = {
  pct: 0.65,
  sets_min: 2,
  sets_max: 4,
  reps_min: 8,
  reps_max: 12,
  rpe_target: 7,
};

function makeFormulaConfig(): FormulaConfig {
  return {
    block1: { heavy: BLOCK_ROW, explosive: BLOCK_ROW, rep: REP_ROW },
    block2: { heavy: BLOCK_ROW, explosive: BLOCK_ROW, rep: REP_ROW },
    block3: { heavy: BLOCK_ROW, explosive: BLOCK_ROW, rep: REP_ROW },
    deload: BLOCK_ROW,
  } as FormulaConfig;
}

// ── toRowDraft ─────────────────────────────────────────────────────────────────

describe('toRowDraft', () => {
  describe('BlockIntensityConfig (no sets_min)', () => {
    it('converts pct to rounded percentage string', () => {
      const draft = toRowDraft(BLOCK_ROW);
      expect(draft.pct).toBe('80');
    });

    it('converts sets and reps to strings', () => {
      const draft = toRowDraft(BLOCK_ROW);
      expect(draft.sets).toBe('3');
      expect(draft.reps).toBe('5');
    });

    it('converts rpe_target to string', () => {
      const draft = toRowDraft(BLOCK_ROW);
      expect(draft.rpeTarget).toBe('8');
    });

    it('omits repsMax when reps_max is undefined', () => {
      const draft = toRowDraft(BLOCK_ROW);
      expect(draft.repsMax).toBeUndefined();
    });

    it('includes repsMax when reps_max is set', () => {
      const draft = toRowDraft(BLOCK_ROW_WITH_REPS_MAX);
      expect(draft.repsMax).toBe('5');
    });

    it('rounds fractional pct correctly (0.766 -> 77)', () => {
      const config: BlockIntensityConfig = { ...BLOCK_ROW, pct: 0.766 };
      expect(toRowDraft(config).pct).toBe('77');
    });

    it('does not set setsMin/setsMax/repsMin on block row', () => {
      const draft = toRowDraft(BLOCK_ROW);
      expect(draft.setsMin).toBeUndefined();
      expect(draft.setsMax).toBeUndefined();
      expect(draft.repsMin).toBeUndefined();
    });
  });

  describe('RepIntensityConfig (has sets_min)', () => {
    it('converts pct to rounded percentage string', () => {
      const draft = toRowDraft(REP_ROW);
      expect(draft.pct).toBe('65');
    });

    it('sets sets to sets_min value', () => {
      const draft = toRowDraft(REP_ROW);
      expect(draft.sets).toBe('2');
    });

    it('sets reps to reps_min value', () => {
      const draft = toRowDraft(REP_ROW);
      expect(draft.reps).toBe('8');
    });

    it('populates setsMin, setsMax, repsMin, repsMax', () => {
      const draft = toRowDraft(REP_ROW);
      expect(draft.setsMin).toBe('2');
      expect(draft.setsMax).toBe('4');
      expect(draft.repsMin).toBe('8');
      expect(draft.repsMax).toBe('12');
    });

    it('converts rpe_target to string', () => {
      const draft = toRowDraft(REP_ROW);
      expect(draft.rpeTarget).toBe('7');
    });
  });
});

// ── initDraft ──────────────────────────────────────────────────────────────────

describe('initDraft', () => {
  it('produces draft keys for all three blocks and deload', () => {
    const draft = initDraft(makeFormulaConfig());
    expect(Object.keys(draft)).toEqual([
      'block1',
      'block2',
      'block3',
      'deload',
    ]);
  });

  it('each main block has heavy, explosive, rep entries', () => {
    const draft = initDraft(makeFormulaConfig());
    for (const key of ['block1', 'block2', 'block3'] as const) {
      expect(draft[key].heavy).toBeDefined();
      expect(draft[key].explosive).toBeDefined();
      expect(draft[key].rep).toBeDefined();
    }
  });

  it('deload only has heavy entry', () => {
    const draft = initDraft(makeFormulaConfig());
    expect(draft.deload.heavy).toBeDefined();
    expect(draft.deload.explosive).toBeUndefined();
    expect(draft.deload.rep).toBeUndefined();
  });

  it('converts pct correctly for block heavy row', () => {
    const draft = initDraft(makeFormulaConfig());
    expect(draft.block1.heavy?.pct).toBe('80');
  });

  it('block rep row carries range fields', () => {
    const draft = initDraft(makeFormulaConfig());
    expect(draft.block1.rep?.setsMin).toBe('2');
    expect(draft.block1.rep?.setsMax).toBe('4');
    expect(draft.block1.rep?.repsMin).toBe('8');
    expect(draft.block1.rep?.repsMax).toBe('12');
  });
});

// ── draftToOverrides ───────────────────────────────────────────────────────────

function makeDraft(): DraftConfig {
  const blockHeavy: RowDraft = {
    pct: '80',
    sets: '3',
    reps: '5',
    rpeTarget: '8',
  };
  const blockExplosive: RowDraft = {
    pct: '60',
    sets: '5',
    reps: '3',
    rpeTarget: '7',
  };
  const repRow: RowDraft = {
    pct: '65',
    sets: '2',
    reps: '8',
    setsMin: '2',
    setsMax: '4',
    repsMin: '8',
    repsMax: '12',
    rpeTarget: '7',
  };
  const deload: RowDraft = {
    pct: '50',
    sets: '3',
    reps: '5',
    rpeTarget: '6',
  };
  return {
    block1: { heavy: blockHeavy, explosive: blockExplosive, rep: repRow },
    block2: { heavy: blockHeavy, explosive: blockExplosive, rep: repRow },
    block3: { heavy: blockHeavy, explosive: blockExplosive, rep: repRow },
    deload: { heavy: deload },
  };
}

// draftToOverrides returns FormulaOverrides (Zod-inferred, all optional) but
// the tests always call makeDraft() which populates all blocks. Cast the block
// intensity to the engine type which includes reps_max.
function heavy(
  overrides: ReturnType<typeof draftToOverrides>
): BlockIntensityConfig {
  return overrides.block1!.heavy as unknown as BlockIntensityConfig;
}

describe('draftToOverrides', () => {
  it('converts pct string to decimal fraction', () => {
    expect(heavy(draftToOverrides(makeDraft())).pct).toBeCloseTo(0.8);
  });

  it('converts block sets and reps to integers', () => {
    const h = heavy(draftToOverrides(makeDraft()));
    expect(h.sets).toBe(3);
    expect(h.reps).toBe(5);
  });

  it('converts rpe_target to number', () => {
    expect(heavy(draftToOverrides(makeDraft())).rpe_target).toBe(8);
  });

  it('omits reps_max on block row when repsMax is absent', () => {
    expect(heavy(draftToOverrides(makeDraft())).reps_max).toBeUndefined();
  });

  it('includes reps_max on block row when repsMax is present', () => {
    const draft = makeDraft();
    draft.block1.heavy!.repsMax = '6';
    expect(heavy(draftToOverrides(draft)).reps_max).toBe(6);
  });

  it('converts rep row to RepIntensityConfig with min/max fields', () => {
    const overrides = draftToOverrides(makeDraft());
    const rep = overrides.block1!.rep!;
    expect(rep.sets_min).toBe(2);
    expect(rep.sets_max).toBe(4);
    expect(rep.reps_min).toBe(8);
    expect(rep.reps_max).toBe(12);
  });

  it('rep row falls back to sets when setsMin/setsMax absent', () => {
    const draft = makeDraft();
    delete draft.block1.rep!.setsMin;
    delete draft.block1.rep!.setsMax;
    const overrides = draftToOverrides(draft);
    // sets field is '2', so both should be 2
    expect(overrides.block1!.rep!.sets_min).toBe(2);
    expect(overrides.block1!.rep!.sets_max).toBe(2);
  });

  it('rep row falls back to reps when repsMin/repsMax absent', () => {
    const draft = makeDraft();
    delete draft.block1.rep!.repsMin;
    delete draft.block1.rep!.repsMax;
    const overrides = draftToOverrides(draft);
    expect(overrides.block1!.rep!.reps_min).toBe(8);
    expect(overrides.block1!.rep!.reps_max).toBe(8);
  });

  it('converts deload row correctly', () => {
    const overrides = draftToOverrides(makeDraft());
    expect(overrides.deload!.pct).toBeCloseTo(0.5);
    expect(overrides.deload!.sets).toBe(3);
    expect(overrides.deload!.reps).toBe(5);
    expect(overrides.deload!.rpe_target).toBe(6);
  });

  it('treats empty/invalid pct strings as 0', () => {
    const draft = makeDraft();
    draft.block1.heavy!.pct = '';
    const overrides = draftToOverrides(draft);
    expect(overrides.block1!.heavy!.pct).toBe(0);
  });

  it('treats empty/invalid sets strings as 0', () => {
    const draft = makeDraft();
    draft.block1.heavy!.sets = 'abc';
    const overrides = draftToOverrides(draft);
    expect(overrides.block1!.heavy!.sets).toBe(0);
  });

  it('produces output for all three blocks', () => {
    const overrides = draftToOverrides(makeDraft());
    expect(overrides.block2!.heavy!.pct).toBeCloseTo(0.8);
    expect(overrides.block3!.explosive!.sets).toBe(5);
  });
});

// ── exampleWeight ──────────────────────────────────────────────────────────────

describe('exampleWeight', () => {
  it('returns formatted kg string for valid inputs', () => {
    // 80% of 100kg = 80kg
    expect(exampleWeight('80', 100)).toBe('80 kg');
  });

  it('rounds to nearest 0.5', () => {
    // 80% of 101kg = 80.8 -> Math.round(80.8 * 2) / 2 = Math.round(161.6) / 2 = 162 / 2 = 81
    expect(exampleWeight('80', 101)).toBe('81 kg');
  });

  it('produces a 0.5 result when the computation lands on a half-step', () => {
    // 50% of 101kg = 50.5 -> Math.round(50.5 * 2) / 2 = Math.round(101) / 2 = 101 / 2 = 50.5
    expect(exampleWeight('50', 101)).toBe('50.5 kg');
  });

  it('returns dash when pct is 0', () => {
    expect(exampleWeight('0', 100)).toBe('—');
  });

  it('returns dash when pct string is empty', () => {
    expect(exampleWeight('', 100)).toBe('—');
  });

  it('returns dash when oneRmKg is 0', () => {
    expect(exampleWeight('80', 0)).toBe('—');
  });

  it('handles fractional pct values', () => {
    // 75% of 200kg = 150kg
    expect(exampleWeight('75', 200)).toBe('150 kg');
  });
});

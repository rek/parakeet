// @spec docs/features/programs/spec-formula-editor.md
import type { FormulaOverrides } from '@parakeet/shared-types';
import type {
  BlockIntensityConfig,
  FormulaConfig,
  RepIntensityConfig,
} from '@parakeet/training-engine';

// ── Types ────────────────────────────────────────────────────────────────────

export type BlockKey = 'block1' | 'block2' | 'block3' | 'deload';

export interface RowDraft {
  pct: string;
  sets: string;
  reps: string;
  repsMax?: string;
  rpeTarget: string;
  setsMin?: string;
  setsMax?: string;
  repsMin?: string;
}

export type DraftConfig = {
  [B in BlockKey]: {
    heavy?: RowDraft;
    explosive?: RowDraft;
    rep?: RowDraft;
  };
};

// ── Conversions ──────────────────────────────────────────────────────────────

export function toRowDraft(
  config: BlockIntensityConfig | RepIntensityConfig
): RowDraft {
  if ('sets_min' in config) {
    return {
      pct: String(Math.round(config.pct * 100)),
      sets: String(config.sets_min),
      reps: String(config.reps_min),
      rpeTarget: String(config.rpe_target),
      setsMin: String(config.sets_min),
      setsMax: String(config.sets_max),
      repsMin: String(config.reps_min),
      repsMax: String(config.reps_max),
    };
  }
  return {
    pct: String(Math.round(config.pct * 100)),
    sets: String(config.sets),
    reps: String(config.reps),
    repsMax: config.reps_max != null ? String(config.reps_max) : undefined,
    rpeTarget: String(config.rpe_target),
  };
}

export function initDraft(config: FormulaConfig): DraftConfig {
  return {
    block1: {
      heavy: toRowDraft(config.block1.heavy),
      explosive: toRowDraft(config.block1.explosive),
      rep: toRowDraft(config.block1.rep),
    },
    block2: {
      heavy: toRowDraft(config.block2.heavy),
      explosive: toRowDraft(config.block2.explosive),
      rep: toRowDraft(config.block2.rep),
    },
    block3: {
      heavy: toRowDraft(config.block3.heavy),
      explosive: toRowDraft(config.block3.explosive),
      rep: toRowDraft(config.block3.rep),
    },
    deload: {
      heavy: toRowDraft(config.deload),
    },
  };
}

export function draftToOverrides(draft: DraftConfig): FormulaOverrides {
  const p = (s: string) => parseFloat(s) || 0;
  const i = (s: string) => parseInt(s, 10) || 0;

  function blockRow(row: RowDraft): BlockIntensityConfig {
    return {
      pct: p(row.pct) / 100,
      sets: i(row.sets),
      reps: i(row.reps),
      rpe_target: p(row.rpeTarget),
      ...(row.repsMax ? { reps_max: i(row.repsMax) } : {}),
    };
  }

  function repRow(row: RowDraft): RepIntensityConfig {
    return {
      pct: p(row.pct) / 100,
      sets_min: i(row.setsMin ?? row.sets),
      sets_max: i(row.setsMax ?? row.sets),
      reps_min: i(row.repsMin ?? row.reps),
      reps_max: i(row.repsMax ?? row.reps),
      rpe_target: p(row.rpeTarget),
    };
  }

  return {
    block1: {
      heavy: blockRow(draft.block1.heavy!),
      explosive: blockRow(draft.block1.explosive!),
      rep: repRow(draft.block1.rep!),
    },
    block2: {
      heavy: blockRow(draft.block2.heavy!),
      explosive: blockRow(draft.block2.explosive!),
      rep: repRow(draft.block2.rep!),
    },
    block3: {
      heavy: blockRow(draft.block3.heavy!),
      explosive: blockRow(draft.block3.explosive!),
      rep: repRow(draft.block3.rep!),
    },
    deload: {
      pct: p(draft.deload.heavy!.pct) / 100,
      sets: i(draft.deload.heavy!.sets),
      reps: i(draft.deload.heavy!.reps),
      rpe_target: p(draft.deload.heavy!.rpeTarget),
    },
  };
}

export function exampleWeight(pct: string, oneRmKg: number): string {
  const p = parseFloat(pct);
  if (!p || !oneRmKg) return '—';
  return `${Math.round((p / 100) * oneRmKg * 2) / 2} kg`;
}

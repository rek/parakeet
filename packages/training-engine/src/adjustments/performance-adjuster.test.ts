import {
  DEFAULT_THRESHOLDS_MALE,
  DEFAULT_THRESHOLDS_FEMALE,
  getDefaultThresholds,
  suggestProgramAdjustments,
} from './performance-adjuster'
import { SessionLogSummary } from '../types'

function makeLog(
  overrides: Partial<SessionLogSummary> & Pick<SessionLogSummary, 'lift' | 'intensity_type'>,
): SessionLogSummary {
  return {
    session_id: 'sess-' + Math.random().toString(36).slice(2),
    actual_rpe: 8.5,
    target_rpe: 8.5,
    completion_pct: 100,
    ...overrides,
  }
}

describe('suggestProgramAdjustments — Rule 1: high RPE', () => {
  it('2 consecutive squat heavy sessions at RPE 9.6 (target 8.5) → reduce_pct suggestion', () => {
    const logs: SessionLogSummary[] = [
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 9.6, target_rpe: 8.5 }),
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 9.6, target_rpe: 8.5 }),
    ]
    const suggestions = suggestProgramAdjustments(logs, DEFAULT_THRESHOLDS_MALE)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].type).toBe('reduce_pct')
    expect(suggestions[0].affected_lift).toBe('squat')
    expect(suggestions[0].affected_block).toBe('heavy')
    expect(suggestions[0].pct_adjustment).toBe(-0.025)
    expect(suggestions[0].rationale).toMatch(/squat heavy RPE/i)
    expect(suggestions[0].rationale).toMatch(/1\.1/)
  })

  it('only 1 high RPE session → no suggestion', () => {
    const logs: SessionLogSummary[] = [
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 9.6, target_rpe: 8.5 }),
    ]
    const result = suggestProgramAdjustments(logs, DEFAULT_THRESHOLDS_MALE)
    expect(result.filter((s) => s.type === 'reduce_pct')).toHaveLength(0)
  })

  it('3 sessions alternating high/normal RPE → no suggestion', () => {
    const logs: SessionLogSummary[] = [
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 9.6, target_rpe: 8.5 }),
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 8.5, target_rpe: 8.5 }),
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 9.6, target_rpe: 8.5 }),
    ]
    const result = suggestProgramAdjustments(logs, DEFAULT_THRESHOLDS_MALE)
    expect(result.filter((s) => s.type === 'reduce_pct')).toHaveLength(0)
  })

  it('high RPE exactly at threshold (= 1.0) → no suggestion (strict >)', () => {
    const logs: SessionLogSummary[] = [
      makeLog({ lift: 'bench', intensity_type: 'heavy', actual_rpe: 9.5, target_rpe: 8.5 }),
      makeLog({ lift: 'bench', intensity_type: 'heavy', actual_rpe: 9.5, target_rpe: 8.5 }),
    ]
    const result = suggestProgramAdjustments(logs, DEFAULT_THRESHOLDS_MALE)
    expect(result.filter((s) => s.type === 'reduce_pct')).toHaveLength(0)
  })
})

describe('suggestProgramAdjustments — Rule 2: low RPE', () => {
  it('2 consecutive sessions with RPE below target → increase_pct suggestion', () => {
    const logs: SessionLogSummary[] = [
      makeLog({ lift: 'deadlift', intensity_type: 'heavy', actual_rpe: 7.0, target_rpe: 8.5 }),
      makeLog({ lift: 'deadlift', intensity_type: 'heavy', actual_rpe: 7.0, target_rpe: 8.5 }),
    ]
    const suggestions = suggestProgramAdjustments(logs, DEFAULT_THRESHOLDS_MALE)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].type).toBe('increase_pct')
    expect(suggestions[0].pct_adjustment).toBe(0.025)
    expect(suggestions[0].rationale).toMatch(/below intended stimulus/i)
  })
})

describe('suggestProgramAdjustments — Rule 3: incomplete session', () => {
  it('session at 60% completion → flag_for_review', () => {
    const id = 'sess-incomplete-1'
    const logs: SessionLogSummary[] = [
      makeLog({ lift: 'squat', intensity_type: 'heavy', completion_pct: 60, session_id: id }),
    ]
    const suggestions = suggestProgramAdjustments(logs, DEFAULT_THRESHOLDS_MALE)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].type).toBe('flag_for_review')
    expect(suggestions[0].session_id).toBe(id)
    expect(suggestions[0].completion_pct).toBe(60)
    expect(suggestions[0].pct_adjustment).toBeNull()
  })

  it('session at exactly 80% → no flag (threshold is < 80, not <=)', () => {
    const logs: SessionLogSummary[] = [
      makeLog({ lift: 'bench', intensity_type: 'rep', completion_pct: 80 }),
    ]
    const result = suggestProgramAdjustments(logs, DEFAULT_THRESHOLDS_MALE)
    expect(result.filter((s) => s.type === 'flag_for_review')).toHaveLength(0)
  })

  it('null completion_pct → no flag', () => {
    const logs: SessionLogSummary[] = [
      makeLog({ lift: 'bench', intensity_type: 'rep', completion_pct: null }),
    ]
    const result = suggestProgramAdjustments(logs, DEFAULT_THRESHOLDS_MALE)
    expect(result.filter((s) => s.type === 'flag_for_review')).toHaveLength(0)
  })
})

describe('suggestProgramAdjustments — max_suggestions_per_lift', () => {
  it('high RPE on both heavy and explosive → only 1 suggestion (max=1)', () => {
    const logs: SessionLogSummary[] = [
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 9.6, target_rpe: 8.5 }),
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 9.6, target_rpe: 8.5 }),
      makeLog({ lift: 'squat', intensity_type: 'explosive', actual_rpe: 9.6, target_rpe: 7.5 }),
      makeLog({ lift: 'squat', intensity_type: 'explosive', actual_rpe: 9.6, target_rpe: 7.5 }),
    ]
    const result = suggestProgramAdjustments(logs, DEFAULT_THRESHOLDS_MALE)
    expect(result.filter((s) => s.type !== 'flag_for_review' && s.affected_lift === 'squat')).toHaveLength(1)
  })

  it('custom max=2 allows two suggestions for same lift', () => {
    const logs: SessionLogSummary[] = [
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 9.6, target_rpe: 8.5 }),
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 9.6, target_rpe: 8.5 }),
      makeLog({ lift: 'squat', intensity_type: 'explosive', actual_rpe: 9.6, target_rpe: 7.5 }),
      makeLog({ lift: 'squat', intensity_type: 'explosive', actual_rpe: 9.6, target_rpe: 7.5 }),
    ]
    const result = suggestProgramAdjustments(logs, { ...DEFAULT_THRESHOLDS_MALE, max_suggestions_per_lift: 2 })
    expect(result.filter((s) => s.type !== 'flag_for_review' && s.affected_lift === 'squat')).toHaveLength(2)
  })
})

describe('suggestProgramAdjustments — no logs', () => {
  it('empty input → empty output', () => {
    expect(suggestProgramAdjustments([])).toEqual([])
  })
})

describe('DEFAULT_THRESHOLDS_FEMALE / getDefaultThresholds', () => {
  it('female thresholds have higher rpe_deviation_threshold', () => {
    expect(DEFAULT_THRESHOLDS_FEMALE.rpe_deviation_threshold).toBe(1.5)
    expect(DEFAULT_THRESHOLDS_FEMALE.consecutive_sessions_required).toBe(3)
  })

  it('getDefaultThresholds("female") returns female thresholds', () => {
    expect(getDefaultThresholds('female')).toBe(DEFAULT_THRESHOLDS_FEMALE)
  })

  it('getDefaultThresholds("male") returns male thresholds', () => {
    expect(getDefaultThresholds('male')).toBe(DEFAULT_THRESHOLDS_MALE)
  })

  it('getDefaultThresholds(undefined) returns male thresholds', () => {
    expect(getDefaultThresholds(undefined)).toBe(DEFAULT_THRESHOLDS_MALE)
  })

  it('2 sessions at +1.2 RPE with female thresholds → no suggestion (below 1.5 threshold)', () => {
    const logs = [
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 9.7, target_rpe: 8.5 }),
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 9.7, target_rpe: 8.5 }),
    ]
    const result = suggestProgramAdjustments(logs, DEFAULT_THRESHOLDS_FEMALE)
    expect(result.filter((s) => s.type === 'reduce_pct')).toHaveLength(0)
  })

  it('3 sessions at +1.6 RPE with female thresholds → reduce_pct suggestion', () => {
    const logs = [
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 10.1, target_rpe: 8.5 }),
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 10.1, target_rpe: 8.5 }),
      makeLog({ lift: 'squat', intensity_type: 'heavy', actual_rpe: 10.1, target_rpe: 8.5 }),
    ]
    const result = suggestProgramAdjustments(logs, DEFAULT_THRESHOLDS_FEMALE)
    expect(result.filter((s) => s.type === 'reduce_pct')).toHaveLength(1)
  })
})

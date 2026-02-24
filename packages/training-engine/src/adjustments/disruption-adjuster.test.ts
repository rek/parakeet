import { suggestDisruptionAdjustment, PlannedSession } from './disruption-adjuster'

function makeDisruption(
  disruption_type: string,
  severity: 'minor' | 'moderate' | 'major',
  affected_lifts: string[] | null = null,
) {
  return { disruption_type, severity, affected_lifts } as Parameters<typeof suggestDisruptionAdjustment>[0]
}

const squat: PlannedSession = { id: 's1', primary_lift: 'squat', status: 'planned' }
const bench: PlannedSession = { id: 's2', primary_lift: 'bench', status: 'planned' }
const deadlift: PlannedSession = { id: 's3', primary_lift: 'deadlift', status: 'planned' }

describe('suggestDisruptionAdjustment — injury', () => {
  it('minor injury affecting squat only → 20% weight_reduced on squat, none on bench/DL', () => {
    const result = suggestDisruptionAdjustment(
      makeDisruption('injury', 'minor', ['squat']),
      [squat, bench, deadlift],
    )
    expect(result).toHaveLength(1)
    expect(result[0].session_id).toBe('s1')
    expect(result[0].action).toBe('weight_reduced')
    expect(result[0].reduction_pct).toBe(20)
  })

  it('moderate injury → 40% weight_reduced', () => {
    const result = suggestDisruptionAdjustment(makeDisruption('injury', 'moderate'), [squat])
    expect(result[0].action).toBe('weight_reduced')
    expect(result[0].reduction_pct).toBe(40)
  })

  it('major injury → session_skipped (not weight_reduced)', () => {
    const result = suggestDisruptionAdjustment(makeDisruption('injury', 'major'), [squat])
    expect(result[0].action).toBe('session_skipped')
    expect(result[0].reduction_pct).toBeUndefined()
  })
})

describe('suggestDisruptionAdjustment — illness', () => {
  it('major illness → all sessions skipped', () => {
    const result = suggestDisruptionAdjustment(
      makeDisruption('illness', 'major'),
      [squat, bench, deadlift],
    )
    expect(result).toHaveLength(3)
    result.forEach((r) => expect(r.action).toBe('session_skipped'))
  })

  it('moderate illness → weight_reduced + reps_reduced per session', () => {
    const result = suggestDisruptionAdjustment(makeDisruption('illness', 'moderate'), [squat])
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.action === 'weight_reduced')?.reduction_pct).toBe(25)
    expect(result.find((r) => r.action === 'reps_reduced')?.reps_reduction).toBe(2)
  })

  it('minor illness → reps_reduced by 2 only', () => {
    const result = suggestDisruptionAdjustment(makeDisruption('illness', 'minor'), [squat])
    expect(result).toHaveLength(1)
    expect(result[0].action).toBe('reps_reduced')
    expect(result[0].reps_reduction).toBe(2)
  })
})

describe('suggestDisruptionAdjustment — travel', () => {
  it('travel (any severity) → 30% weight_reduced with substitution note on all sessions', () => {
    const result = suggestDisruptionAdjustment(
      makeDisruption('travel', 'minor'),
      [squat, bench, deadlift],
    )
    expect(result).toHaveLength(3)
    result.forEach((r) => {
      expect(r.action).toBe('weight_reduced')
      expect(r.reduction_pct).toBe(30)
      expect(r.substitution_note).toMatch(/bodyweight/i)
    })
  })
})

describe('suggestDisruptionAdjustment — fatigue', () => {
  it('fatigue affecting deadlift only → 10% weight_reduced on DL, squat/bench unchanged', () => {
    const result = suggestDisruptionAdjustment(
      makeDisruption('fatigue', 'minor', ['deadlift']),
      [squat, bench, deadlift],
    )
    expect(result).toHaveLength(1)
    expect(result[0].session_id).toBe('s3')
    expect(result[0].action).toBe('weight_reduced')
    expect(result[0].reduction_pct).toBe(10)
  })

  it('moderate fatigue → 20% weight_reduced', () => {
    const result = suggestDisruptionAdjustment(makeDisruption('fatigue', 'moderate'), [squat])
    expect(result[0].reduction_pct).toBe(20)
  })

  it('major fatigue → session_skipped', () => {
    const result = suggestDisruptionAdjustment(makeDisruption('fatigue', 'major'), [squat])
    expect(result[0].action).toBe('session_skipped')
  })
})

describe('suggestDisruptionAdjustment — equipment_unavailable', () => {
  it('returns exercise_substituted with substitution note', () => {
    const result = suggestDisruptionAdjustment(makeDisruption('equipment_unavailable', 'minor'), [squat])
    expect(result[0].action).toBe('exercise_substituted')
    expect(result[0].substitution_note).toBeDefined()
  })
})

describe('suggestDisruptionAdjustment — affected_lifts filter', () => {
  it('null affected_lifts → applies to all sessions', () => {
    const result = suggestDisruptionAdjustment(
      makeDisruption('fatigue', 'minor', null),
      [squat, bench, deadlift],
    )
    expect(result).toHaveLength(3)
  })

  it('empty affected_lifts → applies to all sessions', () => {
    const result = suggestDisruptionAdjustment(
      makeDisruption('fatigue', 'minor', []),
      [squat, bench, deadlift],
    )
    expect(result).toHaveLength(3)
  })

  it('unprogrammed_event → no suggestions', () => {
    const result = suggestDisruptionAdjustment(
      makeDisruption('unprogrammed_event', 'minor'),
      [squat, bench],
    )
    expect(result).toHaveLength(0)
  })
})

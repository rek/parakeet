import { describe, expect, it } from 'vitest'
import { formatSessionDisplay, partitionTodaySessions } from './session-sorting'

// ── formatSessionDisplay ──────────────────────────────────────────────────────

describe('formatSessionDisplay', () => {
  describe('ad-hoc sessions (no primary_lift)', () => {
    it('uses activity_name when provided', () => {
      const result = formatSessionDisplay({ primary_lift: null, activity_name: 'Conditioning', intensity_type: null })
      expect(result.liftName).toBe('Conditioning')
      expect(result.intensityName).toBeNull()
    })

    it('falls back to "Ad-Hoc Workout" when activity_name is absent', () => {
      const result = formatSessionDisplay({ primary_lift: null, activity_name: null, intensity_type: null })
      expect(result.liftName).toBe('Ad-Hoc Workout')
      expect(result.intensityName).toBeNull()
    })

    it('falls back to "Ad-Hoc Workout" when activity_name is undefined', () => {
      const result = formatSessionDisplay({ primary_lift: undefined, intensity_type: null })
      expect(result.liftName).toBe('Ad-Hoc Workout')
      expect(result.intensityName).toBeNull()
    })
  })

  describe('scheduled sessions (with primary_lift)', () => {
    it('maps a known primary_lift via LIFT_LABELS', () => {
      const result = formatSessionDisplay({ primary_lift: 'squat', intensity_type: null })
      expect(result.liftName).toBe('Squat')
    })

    it('maps bench via LIFT_LABELS', () => {
      const result = formatSessionDisplay({ primary_lift: 'bench', intensity_type: null })
      expect(result.liftName).toBe('Bench')
    })

    it('maps deadlift via LIFT_LABELS', () => {
      const result = formatSessionDisplay({ primary_lift: 'deadlift', intensity_type: null })
      expect(result.liftName).toBe('Deadlift')
    })

    it('falls back to raw primary_lift string for unknown lift', () => {
      const result = formatSessionDisplay({ primary_lift: 'overhead_press', intensity_type: null })
      expect(result.liftName).toBe('overhead_press')
    })

    it('maps a known intensity_type via INTENSITY_LABELS', () => {
      const result = formatSessionDisplay({ primary_lift: 'squat', intensity_type: 'heavy' })
      expect(result.intensityName).toBe('Heavy')
    })

    it('maps explosive intensity via INTENSITY_LABELS', () => {
      const result = formatSessionDisplay({ primary_lift: 'bench', intensity_type: 'explosive' })
      expect(result.intensityName).toBe('Explosive')
    })

    it('falls back to raw intensity_type string for unknown intensity', () => {
      const result = formatSessionDisplay({ primary_lift: 'squat', intensity_type: 'custom_type' })
      expect(result.intensityName).toBe('custom_type')
    })

    it('returns null intensityName when intensity_type is absent', () => {
      const result = formatSessionDisplay({ primary_lift: 'squat', intensity_type: null })
      expect(result.intensityName).toBeNull()
    })

    it('returns null intensityName when intensity_type is undefined', () => {
      const result = formatSessionDisplay({ primary_lift: 'deadlift' })
      expect(result.intensityName).toBeNull()
    })
  })
})

// ── partitionTodaySessions ────────────────────────────────────────────────────

describe('partitionTodaySessions', () => {
  it('returns empty arrays for no sessions', () => {
    const result = partitionTodaySessions([])
    expect(result.completed).toHaveLength(0)
    expect(result.upcoming).toHaveLength(0)
  })

  it('places a completed scheduled session in completed', () => {
    const session = { status: 'completed', program_id: 'prog-1', primary_lift: 'squat' }
    const { completed, upcoming } = partitionTodaySessions([session])
    expect(completed).toHaveLength(1)
    expect(upcoming).toHaveLength(0)
  })

  it('places a planned session in upcoming', () => {
    const session = { status: 'planned', program_id: 'prog-1', primary_lift: 'bench' }
    const { completed, upcoming } = partitionTodaySessions([session])
    expect(completed).toHaveLength(0)
    expect(upcoming).toHaveLength(1)
  })

  it('excludes completed ad-hoc sessions from completed list', () => {
    const session = { status: 'completed', program_id: null, primary_lift: null }
    const { completed, upcoming } = partitionTodaySessions([session])
    expect(completed).toHaveLength(0)
    // Completed ad-hoc also excluded from upcoming
    expect(upcoming).toHaveLength(0)
  })

  it('excludes skipped and missed ad-hoc sessions from upcoming', () => {
    const skipped = { status: 'skipped', program_id: null, primary_lift: null }
    const missed = { status: 'missed', program_id: null, primary_lift: null }
    const { upcoming } = partitionTodaySessions([skipped, missed])
    expect(upcoming).toHaveLength(0)
  })

  it('sorts upcoming sessions with in_progress before planned', () => {
    const planned = { status: 'planned', program_id: 'p', primary_lift: 'squat' }
    const inProgress = { status: 'in_progress', program_id: 'p', primary_lift: 'bench' }
    const { upcoming } = partitionTodaySessions([planned, inProgress])
    expect(upcoming[0].status).toBe('in_progress')
    expect(upcoming[1].status).toBe('planned')
  })
})

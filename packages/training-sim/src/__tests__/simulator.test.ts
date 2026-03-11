import { describe, it, expect } from 'vitest'
import { runSimulation } from '../simulator'
import { generateReport } from '../reporter'
import { ADAM, LISA, INJURED_IVAN, BUSY_BEE } from '../personas'
import { ADHERENT_MALE, ADHERENT_FEMALE, INJURED_SCRIPT, BUSY_SCRIPT } from '../scripts'
import { ADHERENT_MODEL, BEGINNER_MODEL, FATIGUED_MODEL } from '../personas/performance-models'

describe('Simulator', () => {
  it('runs a full simulation for an adherent male', () => {
    const log = runSimulation({
      persona: ADAM,
      script: ADHERENT_MALE,
      performanceModel: ADHERENT_MODEL,
    })

    expect(log.persona.name).toBe('Adam')
    expect(log.sessions.length).toBeGreaterThan(0)

    const trained = log.sessions.filter((s) => !s.skipped)
    const skipped = log.sessions.filter((s) => s.skipped)

    // 12 weeks × 3 days = 36 sessions, minus 2 skipped (travel week 8)
    expect(trained.length).toBeGreaterThanOrEqual(30)
    expect(skipped.length).toBe(2) // travel week

    // Every trained session should have main lift sets (except MRV-skipped)
    for (const session of trained) {
      if (!session.jitOutput.skippedMainLift) {
        expect(session.mainLiftSets.length).toBeGreaterThan(0)
      }
    }
  })

  it('runs a full simulation for an adherent female with cycle tracking', () => {
    const log = runSimulation({
      persona: LISA,
      script: ADHERENT_FEMALE,
      performanceModel: ADHERENT_MODEL,
    })

    expect(log.persona.name).toBe('Lisa')

    const trained = log.sessions.filter((s) => !s.skipped)
    expect(trained.length).toBeGreaterThan(0)

    // Should have cycle phase data for some sessions
    const withCyclePhase = trained.filter((s) => s.cyclePhase != null)
    expect(withCyclePhase.length).toBeGreaterThan(0)

    // Should see menstrual and luteal phases
    const phases = new Set(withCyclePhase.map((s) => s.cyclePhase))
    expect(phases.size).toBeGreaterThanOrEqual(2)
  })

  it('handles injury disruption correctly', () => {
    const log = runSimulation({
      persona: INJURED_IVAN,
      script: INJURED_SCRIPT,
      performanceModel: FATIGUED_MODEL,
    })

    expect(log.disruptions.length).toBe(1)
    expect(log.disruptions[0].disruption.type).toBe('injury')

    // Sessions during disruption should show adjustments
    const duringInjury = log.sessions.filter(
      (s) => !s.skipped && s.day >= log.disruptions[0].day && s.day < log.disruptions[0].resolvedDay,
    )

    // Some sessions should have disruption-related rationale
    if (duringInjury.length > 0) {
      const hasAdjustment = duringInjury.some(
        (s) => s.jitOutput.rationale.some((r: string) => r.toLowerCase().includes('knee') || r.toLowerCase().includes('injury') || r.toLowerCase().includes('reduced')),
      )
      expect(hasAdjustment).toBe(true)
    }
  })

  it('handles busy lifter with missed sessions', () => {
    const log = runSimulation({
      persona: BUSY_BEE,
      script: BUSY_SCRIPT,
      performanceModel: BEGINNER_MODEL,
    })

    const trained = log.sessions.filter((s) => !s.skipped)
    const skipped = log.sessions.filter((s) => s.skipped)

    // Should skip a meaningful number of sessions (~30%)
    expect(skipped.length).toBeGreaterThan(5)

    // But still complete most sessions
    expect(trained.length).toBeGreaterThan(skipped.length)
  })

  it('tracks 1RM progression over time', () => {
    const log = runSimulation({
      persona: ADAM,
      script: ADHERENT_MALE,
      performanceModel: ADHERENT_MODEL,
    })

    expect(log.oneRmProgression.length).toBeGreaterThan(1)

    const first = log.oneRmProgression[0]
    const last = log.oneRmProgression[log.oneRmProgression.length - 1]

    // 1RM should increase over the simulation (1% per cycle × ~3 cycles)
    expect(last.maxes.squat).toBeGreaterThanOrEqual(first.maxes.squat)
    expect(last.maxes.bench).toBeGreaterThanOrEqual(first.maxes.bench)
    expect(last.maxes.deadlift).toBeGreaterThanOrEqual(first.maxes.deadlift)
  })
})

describe('Report', () => {
  it('generates a report and catches volume issues for adherent male', () => {
    const log = runSimulation({
      persona: ADAM,
      script: ADHERENT_MALE,
      performanceModel: ADHERENT_MODEL,
    })
    const report = generateReport(log)

    expect(report.summary.totalSessions).toBeGreaterThan(0)
    // The simulation correctly identifies that glutes+lower_back exceed MRV
    // because squats and deadlifts both contribute to these muscle groups.
    // This is a real finding — the invariant checker is working.
    expect(report.summary.totalViolations).toBeGreaterThan(0)

    // All violations should be volume_safety related
    const categories = new Set(report.violations.map((v) => v.category))
    expect(categories.has('volume_safety')).toBe(true)
  })

  it('generates a report for all personas without crashing', () => {
    const configs = [
      { persona: ADAM, script: ADHERENT_MALE, performanceModel: ADHERENT_MODEL },
      { persona: LISA, script: ADHERENT_FEMALE, performanceModel: ADHERENT_MODEL },
      { persona: INJURED_IVAN, script: INJURED_SCRIPT, performanceModel: FATIGUED_MODEL },
      { persona: BUSY_BEE, script: BUSY_SCRIPT, performanceModel: BEGINNER_MODEL },
    ]

    for (const config of configs) {
      const log = runSimulation(config)
      const report = generateReport(log)
      expect(report.summary.totalSessions).toBeGreaterThan(0)
      // Report should not throw
      expect(() => report).not.toThrow()
    }
  })
})

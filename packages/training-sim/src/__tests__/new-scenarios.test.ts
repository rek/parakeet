import { describe, it, expect } from 'vitest'
import { runSimulation } from '../simulator'
import { generateReport, formatReportJson } from '../reporter'
import { ADAM, LISA } from '../personas'
import { ADHERENT_MODEL, FATIGUED_MODEL } from '../personas/performance-models'
import { ILLNESS_SCRIPT, NO_EQUIPMENT_SCRIPT, FATIGUE_ACCUMULATION_SCRIPT } from '../scripts/illness'

describe('Illness script', () => {
  it('runs illness scenario with major disruption', () => {
    const log = runSimulation({
      persona: ADAM,
      script: ILLNESS_SCRIPT,
      performanceModel: ADHERENT_MODEL,
    })

    expect(log.disruptions.length).toBe(1)
    expect(log.disruptions[0].disruption.type).toBe('illness')
    expect(log.disruptions[0].disruption.severity).toBe('major')

    // Week 5 should be fully skipped
    const week5Sessions = log.sessions.filter((s) => s.weekNumber === 5)
    const week5Skipped = week5Sessions.filter((s) => s.skipped)
    expect(week5Skipped.length).toBeGreaterThanOrEqual(2)

    // Sessions after the illness should eventually resume
    const postIllness = log.sessions.filter(
      (s) => !s.skipped && s.day > log.disruptions[0].resolvedDay,
    )
    expect(postIllness.length).toBeGreaterThan(0)
  })
})

describe('No equipment script', () => {
  it('runs equipment unavailable scenario', () => {
    const log = runSimulation({
      persona: LISA,
      script: NO_EQUIPMENT_SCRIPT,
      performanceModel: ADHERENT_MODEL,
    })

    expect(log.disruptions.length).toBe(1)
    expect(log.disruptions[0].disruption.type).toBe('equipment_unavailable')

    // Sessions during disruption should still happen (bodyweight)
    const duringDisruption = log.sessions.filter(
      (s) => !s.skipped && s.day >= log.disruptions[0].day && s.day < log.disruptions[0].resolvedDay,
    )
    expect(duringDisruption.length).toBeGreaterThan(0)

    // Should see bodyweight rationale
    const hasBodyweightRationale = duringDisruption.some(
      (s) => s.jitOutput.rationale.some((r: string) => r.toLowerCase().includes('bodyweight') || r.toLowerCase().includes('equipment')),
    )
    expect(hasBodyweightRationale).toBe(true)
  })
})

describe('Fatigue accumulation script', () => {
  it('runs fatigue buildup scenario', () => {
    const log = runSimulation({
      persona: ADAM,
      script: FATIGUE_ACCUMULATION_SCRIPT,
      performanceModel: FATIGUED_MODEL,
    })

    const trained = log.sessions.filter((s) => !s.skipped)
    expect(trained.length).toBeGreaterThan(0)

    // Weeks 8-9 should show soreness-related adjustments
    const week8_9 = trained.filter(
      (s) => s.weekNumber >= 8 && s.weekNumber <= 9,
    )
    const hasSorenessAdjustment = week8_9.some(
      (s) => s.jitOutput.rationale.some((r: string) => r.toLowerCase().includes('soreness') || r.toLowerCase().includes('readiness') || r.toLowerCase().includes('sleep')),
    )
    expect(hasSorenessAdjustment).toBe(true)

    const report = generateReport(log)
    expect(report.summary.totalSessions).toBeGreaterThan(0)
  })
})

describe('JSON output', () => {
  it('produces valid JSON report', () => {
    const log = runSimulation({
      persona: ADAM,
      script: ILLNESS_SCRIPT,
      performanceModel: ADHERENT_MODEL,
    })
    const report = generateReport(log)
    const json = formatReportJson(report)

    const parsed = JSON.parse(json)
    expect(parsed.persona.name).toBe('Adam')
    expect(parsed.summary.totalSessions).toBeGreaterThan(0)
    expect(parsed.violations).toBeInstanceOf(Array)
    expect(parsed.oneRmProgression).toBeInstanceOf(Array)
    expect(parsed.weeklyVolumeSummary).toBeInstanceOf(Array)
    expect(parsed.disruptions).toBeInstanceOf(Array)
    expect(parsed.disruptions[0].type).toBe('illness')
  })
})

import { SimulationLog, SimulationReport, InvariantViolation } from './types'
import { checkAllInvariants } from './invariants'

export function generateReport(log: SimulationLog): SimulationReport {
  const violations = checkAllInvariants(log)

  const errors = violations.filter((v) => v.severity === 'error').length
  const warnings = violations.filter((v) => v.severity === 'warning').length
  const trainedSessions = log.sessions.filter((s) => !s.skipped).length

  return {
    persona: log.persona,
    script: log.script,
    log,
    violations,
    summary: {
      totalSessions: trainedSessions,
      skippedSessions: log.skippedDays,
      totalViolations: violations.length,
      errors,
      warnings,
      passed: errors === 0,
    },
  }
}

export function formatReport(report: SimulationReport): string {
  const lines: string[] = []

  lines.push(`# Simulation Report: ${report.persona.name} × ${report.script.name}`)
  lines.push('')
  lines.push(`## Persona`)
  lines.push(`- ${report.persona.name}, ${report.persona.ageYears}yo ${report.persona.biologicalSex}, ${report.persona.bodyweightKg}kg`)
  lines.push(`- S/B/D: ${report.persona.squatMaxKg}/${report.persona.benchMaxKg}/${report.persona.deadliftMaxKg} kg`)
  lines.push(`- Training age: ${report.persona.trainingAge}`)
  lines.push('')

  lines.push(`## Summary`)
  lines.push(`- Sessions completed: ${report.summary.totalSessions}`)
  lines.push(`- Sessions skipped: ${report.summary.skippedSessions}`)
  lines.push(`- Disruptions: ${report.log.disruptions.length}`)
  lines.push(`- Total violations: ${report.summary.totalViolations} (${report.summary.errors} errors, ${report.summary.warnings} warnings)`)
  lines.push(`- **Result: ${report.summary.passed ? 'PASSED' : 'FAILED'}**`)
  lines.push('')

  // 1RM progression
  if (report.log.oneRmProgression.length > 1) {
    const first = report.log.oneRmProgression[0]
    const last = report.log.oneRmProgression[report.log.oneRmProgression.length - 1]
    lines.push(`## 1RM Progression`)
    for (const lift of ['squat', 'bench', 'deadlift'] as const) {
      const start = first.maxes[lift]
      const end = last.maxes[lift]
      const pct = (((end - start) / start) * 100).toFixed(1)
      lines.push(`- ${lift}: ${start}kg → ${end}kg (${pct}%)`)
    }
    lines.push('')
  }

  // Violations
  if (report.violations.length > 0) {
    lines.push(`## Violations`)
    lines.push('')

    const byCategory = groupBy(report.violations, (v) => v.category)
    for (const [category, categoryViolations] of Object.entries(byCategory)) {
      lines.push(`### ${formatCategory(category)}`)
      for (const v of categoryViolations) {
        const loc = v.weekNumber ? ` (week ${v.weekNumber}${v.day != null ? `, day ${v.day}` : ''})` : ''
        const icon = v.severity === 'error' ? 'x' : '!'
        lines.push(`- [${icon}] ${v.message}${loc}`)
        if (v.expected && v.actual) {
          lines.push(`  Expected: ${v.expected}, Actual: ${v.actual}`)
        }
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * JSON output for programmatic analysis.
 * Strips the full session log (too large) and keeps only summary + violations + progression.
 */
export function formatReportJson(report: SimulationReport): string {
  const { persona, script, summary, violations, log } = report

  const json = {
    persona: {
      name: persona.name,
      biologicalSex: persona.biologicalSex,
      ageYears: persona.ageYears,
      bodyweightKg: persona.bodyweightKg,
      maxes: {
        squat: persona.squatMaxKg,
        bench: persona.benchMaxKg,
        deadlift: persona.deadliftMaxKg,
      },
      trainingAge: persona.trainingAge,
    },
    script: {
      name: script.name,
      description: script.description,
      totalDays: log.totalDays,
    },
    summary,
    oneRmProgression: log.oneRmProgression,
    disruptions: log.disruptions.map((d) => ({
      day: d.day,
      type: d.disruption.type,
      severity: d.disruption.severity,
      durationDays: d.disruption.durationDays,
      resolvedDay: d.resolvedDay,
    })),
    violations: violations.map((v) => ({
      category: v.category,
      rule: v.rule,
      severity: v.severity,
      message: v.message,
      weekNumber: v.weekNumber,
      day: v.day,
    })),
    weeklyVolumeSummary: buildWeeklyVolumeSummary(log),
  }

  return JSON.stringify(json, null, 2)
}

function buildWeeklyVolumeSummary(log: SimulationLog): Array<{ weekNumber: number; volume: Record<string, number> }> {
  const result: Array<{ weekNumber: number; volume: Record<string, number> }> = []
  const seen = new Set<number>()

  // Take the last session of each week for the final volume snapshot
  for (let i = log.sessions.length - 1; i >= 0; i--) {
    const s = log.sessions[i]
    if (s.skipped || seen.has(s.weekNumber)) continue
    seen.add(s.weekNumber)
    result.push({
      weekNumber: s.weekNumber,
      volume: s.weeklyVolumeSnapshot as Record<string, number>,
    })
  }

  return result.sort((a, b) => a.weekNumber - b.weekNumber)
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
    if (!groups[k]) groups[k] = []
    groups[k].push(item)
  }
  return groups
}

import { generateText, Output } from 'ai'
import { CycleReviewSchema } from '@parakeet/shared-types'
import type { CycleReview, Lift } from '@parakeet/shared-types'
import { CYCLE_REVIEW_MODEL } from '../ai/models'
import { CYCLE_REVIEW_SYSTEM_PROMPT } from '../ai/prompts'
import type { CycleReport, LiftSummary, AuxLiftCorrelation } from './assemble-cycle-report'

export type { CycleReview }

// ---------------------------------------------------------------------------
// PreviousCycleSummary — engine-025
// Derived from stored cycle_reviews rows, not re-computed from raw session data.
// ---------------------------------------------------------------------------

export interface LiftProgressSummary {
  oneRmStartKg: number
  oneRmEndKg: number
  oneRmChangeKg: number
  avgRpeVsTarget: number
  sessionCount: number
}

export interface AuxCorrelationSummary {
  exercise: string
  lift: Lift
  correlationDirection: 'positive' | 'negative' | 'neutral'
}

export interface PreviousCycleSummary {
  cycleNumber: number
  programLengthWeeks: number
  completionPct: number
  liftProgress: Partial<Record<Lift, LiftProgressSummary>>
  topAuxCorrelations: AuxCorrelationSummary[]
  volumeNotes: string[]
  formulaChangesCount: number
  disruptionCount: number
  bodyWeightStartKg: number
  bodyWeightEndKg: number
  wilksScore: number
}

// ---------------------------------------------------------------------------
// Internal helpers for extracting summaries
// ---------------------------------------------------------------------------

export function buildLiftProgress(
  lifts: CycleReport['lifts'],
): Partial<Record<Lift, LiftProgressSummary>> {
  const result: Partial<Record<Lift, LiftProgressSummary>> = {}
  for (const [lift, summary] of Object.entries(lifts) as [Lift, LiftSummary][]) {
    result[lift] = {
      oneRmStartKg: summary.startOneRmKg,
      oneRmEndKg: summary.endOneRmKg,
      oneRmChangeKg: summary.endOneRmKg - summary.startOneRmKg,
      avgRpeVsTarget: summary.avgRpeVsTarget ?? 0,
      sessionCount: summary.sessionCount,
    }
  }
  return result
}

export function extractTopAuxCorrelations(
  auxiliaryInsights: CycleReview['auxiliaryInsights'],
  rawCorrelations: AuxLiftCorrelation[],
): AuxCorrelationSummary[] {
  const positiveSet = new Set(auxiliaryInsights.mostCorrelated.map((c) => c.exercise))
  const negativeSet = new Set(auxiliaryInsights.leastEffective.map((c) => c.exercise))

  return rawCorrelations.slice(0, 5).map((c) => {
    let dir: 'positive' | 'negative' | 'neutral' = 'neutral'
    if (positiveSet.has(c.exercise)) dir = 'positive'
    else if (negativeSet.has(c.exercise)) dir = 'negative'
    return {
      exercise: c.exercise,
      lift: c.lift as Lift,
      correlationDirection: dir,
    }
  })
}

export function buildVolumeNotes(volumeInsights: CycleReview['volumeInsights']): string[] {
  const notes: string[] = []
  if (volumeInsights.musclesUnderRecovered.length > 0) {
    notes.push(`Under-recovered: ${volumeInsights.musclesUnderRecovered.join(', ')}`)
  }
  if (volumeInsights.musclesUndertrained.length > 0) {
    notes.push(`Undertrained: ${volumeInsights.musclesUndertrained.join(', ')}`)
  }
  if (volumeInsights.frequencyRecommendation) {
    notes.push(volumeInsights.frequencyRecommendation)
  }
  return notes
}

export function extractSummary(
  report: CycleReport,
  review: CycleReview,
  cycleNumber: number,
  bodyWeightStartKg: number,
  bodyWeightEndKg: number,
  wilksScore: number,
): PreviousCycleSummary {
  return {
    cycleNumber,
    programLengthWeeks: report.totalWeeks,
    completionPct: report.completionPct,
    liftProgress: buildLiftProgress(report.lifts),
    topAuxCorrelations: extractTopAuxCorrelations(
      review.auxiliaryInsights,
      report.auxiliaryCorrelations,
    ),
    volumeNotes: buildVolumeNotes(review.volumeInsights),
    formulaChangesCount: report.formulaChanges.length,
    disruptionCount: report.disruptions.length,
    bodyWeightStartKg,
    bodyWeightEndKg,
    wilksScore,
  }
}

// ---------------------------------------------------------------------------
// Prompt assembly — engine-025
// ---------------------------------------------------------------------------

const MULTI_CYCLE_INSTRUCTION = `
You have been given summaries of the previous N training cycles. Use this history to:
- Identify trends across cycles (e.g., consistent stalling on a lift)
- Flag exercises that have shown no correlation for 2+ cycles
- Note whether formula changes from previous cycles improved outcomes
- Avoid repeating suggestions that have already been implemented (check formulaChangesCount)
Do not repeat information from previous cycles in your response — focus on what is NEW or CHANGED.
`.trim()

export function assembleCycleReviewPrompt(
  cycleReport: CycleReport,
  previousSummaries: PreviousCycleSummary[],
): string {
  const currentCycleContext = JSON.stringify({ cycleReport }, null, 2)

  const previousContext =
    previousSummaries.length > 0
      ? `\n\n${MULTI_CYCLE_INSTRUCTION}\n\nPrevious ${previousSummaries.length} cycle(s) summary:\n${JSON.stringify(previousSummaries, null, 2)}`
      : '\n\nThis is the first completed cycle — no historical comparison available.'

  return currentCycleContext + previousContext
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export async function generateCycleReview(
  cycleReport: CycleReport,
  previousSummaries: PreviousCycleSummary[] = [],
): Promise<CycleReview> {
  const prompt = assembleCycleReviewPrompt(cycleReport, previousSummaries)

  const { output } = await generateText({
    model: CYCLE_REVIEW_MODEL,
    output: Output.object({ schema: CycleReviewSchema }),
    system: CYCLE_REVIEW_SYSTEM_PROMPT,
    prompt,
  })
  return output
}

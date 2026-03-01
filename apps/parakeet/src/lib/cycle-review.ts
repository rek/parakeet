import {
  assembleCycleReport,
  generateCycleReview,
  extractSummary,
} from '@parakeet/training-engine'
import type { CycleReport, RawCycleData, PreviousCycleSummary } from '@parakeet/training-engine'
import type { CycleReview } from '@parakeet/shared-types'
import {
  fetchCycleReportSourceData,
  fetchCycleReviewByProgram,
  fetchPreviousCycleReviewRows,
  insertCycleReviewRow,
  insertDeveloperSuggestion,
  insertFormulaSuggestionConfig,
} from '../data/cycle-review.repository'

export async function getCycleReview(programId: string, userId: string) {
  const existing = await fetchCycleReviewByProgram(programId, userId)
  if (existing) return existing

  const report = await compileCycleReport(programId, userId)
  const previousSummaries = await getPreviousCycleSummaries(userId, programId, 3)
  const review = await generateCycleReview(report, previousSummaries)
  await storeCycleReview(programId, userId, report, review)
  return review
}

export async function compileCycleReport(
  programId: string,
  userId: string,
): Promise<CycleReport> {
  const raw: RawCycleData = await fetchCycleReportSourceData(programId, userId)
  return assembleCycleReport(raw)
}

export async function getPreviousCycleSummaries(
  userId: string,
  beforeProgramId: string,
  limit = 3,
): Promise<PreviousCycleSummary[]> {
  const data = await fetchPreviousCycleReviewRows(userId, beforeProgramId, limit)
  if (!data || data.length === 0) return []

  return data.map((row, index) => {
    const report = row.compiled_report as unknown as CycleReport
    const review = row.llm_response as unknown as CycleReview
    const cycleNumber = data.length - index // most recent = highest number
    return extractSummary(report, review, cycleNumber, 0, 0, 0)
  })
}

export async function storeCycleReview(
  programId: string,
  userId: string,
  compiledReport: CycleReport,
  llmResponse: CycleReview,
): Promise<void> {
  await insertCycleReviewRow({ programId, userId, compiledReport, llmResponse })

  // Route formula suggestions → pending formula_configs
  for (const suggestion of llmResponse.formulaSuggestions ?? []) {
    await insertFormulaSuggestionConfig({
      userId,
      source: 'ai_suggestion',
      overrides: suggestion.overrides ?? {},
      aiRationale: `${suggestion.description} — ${suggestion.rationale}`,
    })
  }

  // Route structural suggestions → developer_suggestions (engine-024)
  for (const suggestion of llmResponse.structuralSuggestions ?? []) {
    await insertDeveloperSuggestion({
      userId,
      programId,
      description: suggestion.description,
      rationale: suggestion.rationale,
      developerNote: suggestion.developerNote,
    })
  }
}

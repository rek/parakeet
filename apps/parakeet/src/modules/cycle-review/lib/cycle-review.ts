// @spec docs/features/cycle-review/spec-generator.md
import type { CycleReview } from '@parakeet/shared-types';
import {
  assembleCycleReport,
  extractSummary,
  generateCycleReview,
} from '@parakeet/training-engine';
import type {
  CycleReport,
  PreviousCycleSummary,
  RawCycleData,
} from '@parakeet/training-engine';
import { fromJson } from '@platform/supabase';

import {
  fetchCycleReportSourceData,
  fetchCycleReviewByProgram,
  fetchPreviousCycleReviewRows,
  insertCycleReviewRow,
  insertDeveloperSuggestion,
  insertFormulaSuggestionConfig,
} from '../data/cycle-review.repository';

export async function getCycleReview(
  programId: string,
  userId: string
): Promise<CycleReview | null> {
  return fetchCycleReviewByProgram(programId, userId);
}

export async function triggerCycleReview(
  programId: string,
  userId: string
): Promise<CycleReview> {
  // Guard: return existing review rather than spending another LLM call.
  // Covers the race between the fire-and-forget onCycleComplete path and
  // manual user retries from the cycle review screen.
  const existing = await getCycleReview(programId, userId);
  if (existing) return existing;

  const report = await compileCycleReport(programId, userId);
  const previousSummaries = await getPreviousCycleSummaries(
    userId,
    programId,
    3
  );
  const review = await generateCycleReview(report, previousSummaries);
  await storeCycleReview(programId, userId, report, review);
  return review;
}

export async function compileCycleReport(
  programId: string,
  userId: string
): Promise<CycleReport> {
  const raw: RawCycleData = await fetchCycleReportSourceData(programId, userId);
  return assembleCycleReport(raw);
}

export async function getPreviousCycleSummaries(
  userId: string,
  beforeProgramId: string,
  limit = 3
): Promise<PreviousCycleSummary[]> {
  const data = await fetchPreviousCycleReviewRows(
    userId,
    beforeProgramId,
    limit
  );
  if (!data || data.length === 0) return [];

  return data.map((row, index) => {
    const report = fromJson<CycleReport>(row.compiled_report);
    const review = fromJson<CycleReview>(row.llm_response);
    const cycleNumber = data.length - index;
    return extractSummary(report, review, cycleNumber, 0, 0, 0);
  });
}

export async function storeCycleReview(
  programId: string,
  userId: string,
  compiledReport: CycleReport,
  llmResponse: CycleReview
): Promise<void> {
  await insertCycleReviewRow({
    programId,
    userId,
    compiledReport,
    llmResponse,
  });

  for (const suggestion of llmResponse.formulaSuggestions ?? []) {
    await insertFormulaSuggestionConfig({
      userId,
      source: 'ai_suggestion',
      overrides: suggestion.overrides ?? {},
      aiRationale: `${suggestion.description} — ${suggestion.rationale}`,
    });
  }

  for (const suggestion of llmResponse.structuralSuggestions ?? []) {
    await insertDeveloperSuggestion({
      userId,
      programId,
      description: suggestion.description,
      rationale: suggestion.rationale,
      developerNote: suggestion.developerNote,
    });
  }
}

// @spec docs/features/cycle-review/spec-generator.md
import { fetchSnapshotsForRange } from '@modules/wearable';
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
  insertPendingCycleReviewRow,
  markCycleReviewErrored,
} from '../data/cycle-review.repository';

export async function getCycleReview(programId: string, userId: string) {
  return fetchCycleReviewByProgram(programId, userId);
}

export async function markCycleReviewPending(
  programId: string,
  userId: string
): Promise<void> {
  await insertPendingCycleReviewRow({ programId, userId });
}

export async function triggerCycleReview(
  programId: string,
  userId: string
): Promise<CycleReview> {
  // Guard: return existing review rather than spending another LLM call.
  // Covers the race between the fire-and-forget onCycleComplete path and
  // manual user retries from the cycle review screen.
  const existing = await getCycleReview(programId, userId);
  if (existing?.status === 'complete') return existing.review!;

  // Mark pending (idempotent upsert) before LLM so UI can offer retry if this fails.
  await markCycleReviewPending(programId, userId);

  try {
    const report = await compileCycleReport(programId, userId);
    const previousSummaries = await getPreviousCycleSummaries(
      userId,
      programId,
      3
    );
    const review = await generateCycleReview(report, previousSummaries);
    await storeCycleReview(programId, userId, report, review);
    return review;
  } catch (err) {
    // Flip the pending row to 'error' so the UI can stop polling and surface
    // a retry button immediately rather than spinning indefinitely.
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown generation error';
    try {
      await markCycleReviewErrored({ programId, userId, errorMessage });
    } catch {
      // Best-effort — the original error is the one the caller needs.
    }
    throw err;
  }
}

export async function compileCycleReport(
  programId: string,
  userId: string
): Promise<CycleReport> {
  const raw: RawCycleData = await fetchCycleReportSourceData(programId, userId);
  const startDate = raw.program.start_date;
  const endDate = new Date().toISOString().slice(0, 10);
  const recoverySnapshots = await fetchSnapshotsForRange(
    userId,
    startDate,
    endDate
  );
  return assembleCycleReport({ ...raw, recoverySnapshots });
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
  const inserted = await insertCycleReviewRow({
    programId,
    userId,
    compiledReport,
    llmResponse,
  });

  // Skip dependent inserts if this program already had a review — concurrent
  // generation attempts (onCycleComplete + manual retry) share the same guard.
  if (!inserted) return;

  // formulaSuggestions are advisory-only. The previous code inserted an empty
  // `overrides: {}` row into `formula_configs` which had no effect — silent
  // no-op. The editor's Accept button is being reworked elsewhere to navigate-
  // and-prefill instead of apply, so the insert is removed entirely.

  // Developer suggestions: idempotent on (cycle_review_id, suggestion_index)
  // via the unique partial index added in 20260523010000_cycle_review_error_state.sql.
  // Retries after a partial failure simply overwrite the same row.
  const suggestions = llmResponse.structuralSuggestions ?? [];
  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i];
    await insertDeveloperSuggestion({
      userId,
      programId,
      description: suggestion.description,
      rationale: suggestion.rationale,
      developerNote: suggestion.developerNote,
      suggestionIndex: i,
    });
  }
}

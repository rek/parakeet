import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@parakeet/training-engine', () => ({
  assembleCycleReport: vi.fn(() => ({ totalWeeks: 4 } as never)),
  extractSummary: vi.fn(),
  generateCycleReview: vi.fn(),
}));

vi.mock('@platform/supabase', () => ({
  fromJson: vi.fn(),
}));

vi.mock('@modules/wearable', () => ({
  fetchSnapshotsForRange: vi.fn(async () => []),
}));

vi.mock('../data/cycle-review.repository', () => ({
  fetchCycleReportSourceData: vi.fn(async () => ({
    program: { total_weeks: 4, start_date: '2026-01-01' },
  })),
  fetchCycleReviewByProgram: vi.fn(async () => null),
  fetchPreviousCycleReviewRows: vi.fn(async () => []),
  insertCycleReviewRow: vi.fn(),
  insertDeveloperSuggestion: vi.fn(),
  insertPendingCycleReviewRow: vi.fn(),
  markCycleReviewErrored: vi.fn(),
}));

import { generateCycleReview } from '@parakeet/training-engine';
import {
  insertPendingCycleReviewRow,
  markCycleReviewErrored,
} from '../data/cycle-review.repository';

import { triggerCycleReview } from './cycle-review';

describe('triggerCycleReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('flips the pending row to error and rethrows when generateCycleReview throws', async () => {
    vi.mocked(generateCycleReview).mockRejectedValueOnce(
      new Error('LLM timed out')
    );

    await expect(triggerCycleReview('prog-1', 'user-1')).rejects.toThrow(
      'LLM timed out'
    );

    expect(insertPendingCycleReviewRow).toHaveBeenCalledWith({
      programId: 'prog-1',
      userId: 'user-1',
    });
    expect(markCycleReviewErrored).toHaveBeenCalledWith({
      programId: 'prog-1',
      userId: 'user-1',
      errorMessage: 'LLM timed out',
    });
  });

  it('still rethrows the original error if markCycleReviewErrored itself fails', async () => {
    vi.mocked(generateCycleReview).mockRejectedValueOnce(new Error('boom'));
    vi.mocked(markCycleReviewErrored).mockRejectedValueOnce(
      new Error('DB unreachable')
    );

    await expect(triggerCycleReview('prog-2', 'user-2')).rejects.toThrow(
      'boom'
    );
  });

  it('coerces non-Error throws into a generic message', async () => {
    vi.mocked(generateCycleReview).mockRejectedValueOnce('string thrown' as never);

    await expect(triggerCycleReview('prog-3', 'user-3')).rejects.toBeDefined();

    expect(markCycleReviewErrored).toHaveBeenCalledWith({
      programId: 'prog-3',
      userId: 'user-3',
      errorMessage: 'Unknown generation error',
    });
  });
});

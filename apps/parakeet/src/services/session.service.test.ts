// session.service.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeSession } from './session.service';

const repoMocks = vi.hoisted(() => ({
  fetchCompletedSessions: vi.fn(),
  fetchCurrentWeekLogs: vi.fn(),
  fetchLastCompletedAtForLift: vi.fn(),
  fetchOverdueScheduledSessions: vi.fn(),
  fetchProfileSex: vi.fn(),
  fetchProgramSessionStatuses: vi.fn(),
  fetchProgramSessionsForMakeup: vi.fn(),
  fetchRecentLogsForLift: vi.fn(),
  fetchSessionById: vi.fn(),
  fetchSessionCompletionContext: vi.fn(),
  fetchSessionsForWeek: vi.fn(),
  fetchTodaySession: vi.fn(),
  insertPerformanceMetric: vi.fn(),
  insertSessionLog: vi.fn(),
  insertSorenessCheckin: vi.fn(),
  markSessionAsMissed: vi.fn(),
  updateSessionToCompleted: vi.fn(),
  updateSessionToInProgress: vi.fn(),
  updateSessionToSkipped: vi.fn(),
}));

vi.mock('@parakeet/training-engine', () => ({
  suggestProgramAdjustments: vi.fn(() => []),
  getDefaultThresholds: vi.fn(() => ({})),
  isMakeupWindowExpired: vi.fn(() => false),
}));

vi.mock('../data/session.repository', () => repoMocks);

describe('completeSession completion semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMocks.insertSessionLog.mockResolvedValue('log-1');
    repoMocks.updateSessionToCompleted.mockResolvedValue(undefined);
    repoMocks.fetchProgramSessionStatuses.mockResolvedValue([]);
  });

  it('uses explicit is_completed flags and logs 0% when no sets were confirmed complete', async () => {
    repoMocks.fetchSessionById.mockResolvedValue({
      id: 'session-1',
      planned_sets: [{}, {}, {}],
      primary_lift: null,
      program_id: null,
    });

    await completeSession('session-1', 'user-1', {
      actualSets: [
        {
          set_number: 1,
          weight_grams: 100000,
          reps_completed: 5,
          is_completed: false,
        },
        {
          set_number: 2,
          weight_grams: 100000,
          reps_completed: 5,
          is_completed: false,
        },
        {
          set_number: 3,
          weight_grams: 100000,
          reps_completed: 5,
          is_completed: false,
        },
      ],
    });

    expect(repoMocks.insertSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        completionPct: 0,
        performanceVsPlan: 'incomplete',
        actualSets: [
          { set_number: 1, weight_grams: 100000, reps_completed: 5 },
          { set_number: 2, weight_grams: 100000, reps_completed: 5 },
          { set_number: 3, weight_grams: 100000, reps_completed: 5 },
        ],
      })
    );
    expect(repoMocks.updateSessionToCompleted).toHaveBeenCalledWith(
      'session-1'
    );
  });

  it('uses planned set count as denominator even when fewer sets were logged', async () => {
    repoMocks.fetchSessionById.mockResolvedValue({
      id: 'session-2',
      planned_sets: [{}, {}, {}, {}],
      primary_lift: null,
      program_id: null,
    });

    await completeSession('session-2', 'user-1', {
      actualSets: [
        {
          set_number: 1,
          weight_grams: 120000,
          reps_completed: 3,
          is_completed: true,
        },
        {
          set_number: 2,
          weight_grams: 120000,
          reps_completed: 3,
          is_completed: true,
        },
        {
          set_number: 3,
          weight_grams: 120000,
          reps_completed: 3,
          is_completed: true,
        },
      ],
    });

    expect(repoMocks.insertSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        completionPct: 75,
        performanceVsPlan: 'under',
      })
    );
  });
});

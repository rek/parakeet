import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectBadges } from './badge-detection.service';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockFetchUserBadgeIds = vi.hoisted(() => vi.fn());
const mockInsertBadges = vi.hoisted(() => vi.fn());
const mockFetchSessionsForStreak = vi.hoisted(() => vi.fn());
const mockFetchDisruptionsForStreak = vi.hoisted(() => vi.fn());
const mockFetchBadgeSessionLog = vi.hoisted(() => vi.fn(async () => null));
const mockFetchBadgeProfile = vi.hoisted(() =>
  vi.fn(async () => ({ bodyweight_kg: 90 }))
);
const mockFetchCompletedSessionCount = vi.hoisted(() =>
  vi.fn(async () => 0)
);
const mockFetchPreviousSession = vi.hoisted(() => vi.fn(async () => null));
const mockFetchAllLiftE1RMs = vi.hoisted(() => vi.fn(async () => []));
const mockFetchSorenessData = vi.hoisted(() =>
  vi.fn(async () => ({ sleepQuality: null, energyLevel: null }))
);
const mockFetchDisruptionContext = vi.hoisted(() =>
  vi.fn(async () => ({
    hasActiveMajor: false,
    daysSinceLast: null,
    lastDurationDays: null,
  }))
);
const mockFetchPrTypeCounts = vi.hoisted(() =>
  vi.fn(async () => ({ volumePrCount: 0, oneRmPrCount: 0 }))
);
const mockFetchConsistencyData = vi.hoisted(() =>
  vi.fn(async (_userId: string, _sessionId: string, streakWeeks: number) => ({
    sessionsBeforeSixAm: 0,
    sessionsAfterNinePm: 0,
    distinctSundaySessions: 0,
    streakWeeks,
    consecutiveLegDaySessions: 0,
    isPerfectWeek: false,
    consecutivePerfectSessions: 0,
  }))
);
const mockFetchProgramLoyaltyData = vi.hoisted(() =>
  vi.fn(async () => ({
    consecutiveSameFormulaCycles: 0,
    formulaChangesThisCycle: 0,
    consecutiveCyclesWithoutDeload: 0,
  }))
);
const mockFetchUniqueAuxExercisesInCycle = vi.hoisted(() =>
  vi.fn(async () => 0)
);
const mockFetchConsecutiveFullRestSessions = vi.hoisted(() =>
  vi.fn(async () => 0)
);
const mockFetchPartnerCompletedToday = vi.hoisted(() =>
  vi.fn(async () => false)
);

// badge checkers — each returns an array of badge IDs
const mockCheckPerformanceBadges = vi.hoisted(() => vi.fn((): string[] => []));
const mockCheckSituationalBadges = vi.hoisted(() => vi.fn((): string[] => []));
const mockCheckRpeEffortBadges = vi.hoisted(() => vi.fn((): string[] => []));
const mockCheckVolumeRepBadges = vi.hoisted(() => vi.fn((): string[] => []));
const mockCheckSessionMilestoneBadges = vi.hoisted(() =>
  vi.fn((): string[] => [])
);
const mockCheckWildRareBadges = vi.hoisted(() => vi.fn((): string[] => []));
const mockCheckLiftIdentityBadges = vi.hoisted(() => vi.fn((): string[] => []));
const mockCheckRestPacingBadges = vi.hoisted(() => vi.fn((): string[] => []));
const mockCheckConsistencyBadges = vi.hoisted(() => vi.fn((): string[] => []));
const mockCheckProgramLoyaltyBadges = vi.hoisted(() =>
  vi.fn((): string[] => [])
);
const mockCheckCouplesBadges = vi.hoisted(() => vi.fn((): string[] => []));
const mockDetectStreakBreakAndRebuild = vi.hoisted(() => vi.fn(() => false));
const mockBuildWeekStatuses = vi.hoisted(() => vi.fn(() => []));

vi.mock('../data/badge.repository', () => ({
  fetchUserBadgeIds: mockFetchUserBadgeIds,
  insertBadges: mockInsertBadges,
}));

vi.mock('../data/achievement.repository', () => ({
  fetchSessionsForStreak: mockFetchSessionsForStreak,
  fetchDisruptionsForStreak: mockFetchDisruptionsForStreak,
  fetchBadgeSessionLog: mockFetchBadgeSessionLog,
  fetchBadgeProfile: mockFetchBadgeProfile,
  fetchCompletedSessionCount: mockFetchCompletedSessionCount,
  fetchPreviousSession: mockFetchPreviousSession,
  fetchAllLiftE1RMs: mockFetchAllLiftE1RMs,
  fetchSorenessData: mockFetchSorenessData,
  fetchDisruptionContext: mockFetchDisruptionContext,
  fetchPrTypeCounts: mockFetchPrTypeCounts,
  fetchConsistencyData: mockFetchConsistencyData,
  fetchProgramLoyaltyData: mockFetchProgramLoyaltyData,
  fetchUniqueAuxExercisesInCycle: mockFetchUniqueAuxExercisesInCycle,
  fetchConsecutiveFullRestSessions: mockFetchConsecutiveFullRestSessions,
  fetchPartnerCompletedToday: mockFetchPartnerCompletedToday,
}));

vi.mock('../utils/week-status-builder', () => ({
  buildWeekStatuses: mockBuildWeekStatuses,
}));

vi.mock('@parakeet/training-engine', () => ({
  checkPerformanceBadges: mockCheckPerformanceBadges,
  checkSituationalBadges: mockCheckSituationalBadges,
  checkRpeEffortBadges: mockCheckRpeEffortBadges,
  checkVolumeRepBadges: mockCheckVolumeRepBadges,
  checkSessionMilestoneBadges: mockCheckSessionMilestoneBadges,
  checkWildRareBadges: mockCheckWildRareBadges,
  checkLiftIdentityBadges: mockCheckLiftIdentityBadges,
  checkRestPacingBadges: mockCheckRestPacingBadges,
  checkConsistencyBadges: mockCheckConsistencyBadges,
  checkProgramLoyaltyBadges: mockCheckProgramLoyaltyBadges,
  checkCouplesBadges: mockCheckCouplesBadges,
  detectStreakBreakAndRebuild: mockDetectStreakBreakAndRebuild,
  BADGE_CATALOG: {
    first_blood: {
      id: 'first_blood',
      name: 'First Blood',
      emoji: '🩸',
      flavor: 'The first drop.',
    },
    century_club: {
      id: 'century_club',
      name: 'Century Club',
      emoji: '💯',
      flavor: '100 sessions complete.',
    },
    send_it: {
      id: 'send_it',
      name: 'Send It',
      emoji: '🚀',
      flavor: 'No hesitation.',
    },
  },
  // Minimum additional exports needed because badge-detection now imports
  // from @modules/session barrel, which transitively exercises more engine
  // surface. These stubs mirror the real values where shape matters.
  LIFTS: ['squat', 'bench', 'deadlift'],
  getMusclesForLift: () => [],
  getMusclesForExercise: () => [],
  rpeSetMultiplier: () => 1,
  LiftSchema: {
    parse: (v: unknown) => v as string,
    safeParse: (v: unknown) => ({ success: true, data: v as string }),
  },
  IntensityTypeSchema: {
    parse: (v: unknown) => v as string,
    safeParse: (v: unknown) => ({ success: true, data: v as string }),
  },
  BlockNumberSchema: {
    parse: (v: unknown) => v as number,
    safeParse: (v: unknown) => ({ success: true, data: v as number }),
  },
}));

// @modules/session barrel pulls in RN UI — mock the only surface we touch.
const mockGetSessionSetsBySessionIds = vi.hoisted(() =>
  vi.fn(async () => new Map())
);
vi.mock('@modules/session', () => ({
  getSessionSetsBySessionIds: mockGetSessionSetsBySessionIds,
}));

const mockSupabaseFrom = vi.hoisted(() => vi.fn());

vi.mock('@platform/supabase', () => ({
  typedSupabase: {
    from: mockSupabaseFrom,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeChainableQuery({
  data = null,
  error = null,
  count = null,
}: {
  data?: unknown;
  error?: unknown;
  count?: number | null;
} = {}) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  q.select = self;
  q.eq = self;
  q.neq = self;
  q.in = self;
  q.not = self;
  q.or = self;
  q.lt = self;
  q.gt = self;
  q.gte = self;
  q.lte = self;
  q.order = self;
  q.limit = self;
  q.maybeSingle = () => Promise.resolve({ data, error });
  q.single = () => Promise.resolve({ data, error });
  // For count queries (.select('id', { count: 'exact', head: true }))
  // The chain is the same but the terminal is the promise itself
  q.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data, error, count }).then(resolve);
  return q;
}

const SESSION_ID = 'session-abc';
const USER_ID = 'user-xyz';

const BASE_INPUT = {
  sessionId: SESSION_ID,
  userId: USER_ID,
  actualSets: [
    {
      weight_grams: 100000,
      reps_completed: 5,
      rpe_actual: 8,
      is_completed: true,
    },
  ],
  earnedPRs: [],
  streakWeeks: 3,
  cycleBadgeEarned: false,
  primaryLift: 'squat' as const,
  programId: 'program-1',
  previousE1Rm: {},
};

// Build a default mock setup where all DB calls return empty/null
function setupDefaultMocks() {
  mockFetchUserBadgeIds.mockResolvedValue(new Set());
  mockInsertBadges.mockResolvedValue(undefined);
  mockFetchSessionsForStreak.mockResolvedValue([]);
  mockFetchDisruptionsForStreak.mockResolvedValue([]);
  mockDetectStreakBreakAndRebuild.mockReturnValue(false);
  mockBuildWeekStatuses.mockReturnValue([]);

  // Reset all checkers to return empty
  mockCheckPerformanceBadges.mockReturnValue([]);
  mockCheckSituationalBadges.mockReturnValue([]);
  mockCheckRpeEffortBadges.mockReturnValue([]);
  mockCheckVolumeRepBadges.mockReturnValue([]);
  mockCheckSessionMilestoneBadges.mockReturnValue([]);
  mockCheckWildRareBadges.mockReturnValue([]);
  mockCheckLiftIdentityBadges.mockReturnValue([]);
  mockCheckRestPacingBadges.mockReturnValue([]);
  mockCheckConsistencyBadges.mockReturnValue([]);
  mockCheckProgramLoyaltyBadges.mockReturnValue([]);

  // All DB table queries return empty/null by default
  mockSupabaseFrom.mockImplementation((table: string) => {
    // session_logs: returns null for session log, empty for consecutive queries
    if (table === 'session_logs') {
      return makeChainableQuery({ data: null });
    }
    // sessions: return empty array
    if (table === 'sessions') {
      return makeChainableQuery({ data: [], count: 0 });
    }
    // profiles
    if (table === 'profiles') {
      return makeChainableQuery({ data: { bodyweight_kg: 90 } });
    }
    // personal_records
    if (table === 'personal_records') {
      return makeChainableQuery({ data: [] });
    }
    // soreness_checkins
    if (table === 'soreness_checkins') {
      return makeChainableQuery({ data: null });
    }
    // disruptions
    if (table === 'disruptions') {
      return makeChainableQuery({ data: [] });
    }
    // programs
    if (table === 'programs') {
      return makeChainableQuery({ data: [] });
    }
    // formula_configs
    if (table === 'formula_configs') {
      return makeChainableQuery({ data: null, count: 0 });
    }
    // user_badges (fetchUserBadgeIds uses typedSupabase directly but we mocked
    // fetchUserBadgeIds at the repository level — this is a safety fallback)
    return makeChainableQuery({ data: [] });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('detectBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  describe('when checkers award badges not yet earned', () => {
    it('returns earned badge metadata for a new badge', async () => {
      mockCheckSessionMilestoneBadges.mockReturnValue(['first_blood']);

      const result = await detectBadges(BASE_INPUT);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'first_blood',
        name: 'First Blood',
        emoji: '🩸',
        flavor: 'The first drop.',
      });
    });

    it('persists new badges via insertBadges', async () => {
      mockCheckSessionMilestoneBadges.mockReturnValue(['first_blood']);

      await detectBadges(BASE_INPUT);

      expect(mockInsertBadges).toHaveBeenCalledOnce();
      expect(mockInsertBadges).toHaveBeenCalledWith(USER_ID, [
        { badgeId: 'first_blood', sessionId: SESSION_ID },
      ]);
    });

    it('returns multiple badges when several checkers fire', async () => {
      mockCheckSessionMilestoneBadges.mockReturnValue(['first_blood']);
      mockCheckRpeEffortBadges.mockReturnValue(['send_it']);

      const result = await detectBadges(BASE_INPUT);

      expect(result).toHaveLength(2);
      expect(result.map((b) => b.id)).toEqual(
        expect.arrayContaining(['first_blood', 'send_it'])
      );
    });
  });

  describe('when badge is already earned', () => {
    it('filters out already-earned badges', async () => {
      mockCheckSessionMilestoneBadges.mockReturnValue(['first_blood']);
      mockFetchUserBadgeIds.mockResolvedValue(new Set(['first_blood']));

      const result = await detectBadges(BASE_INPUT);

      expect(result).toHaveLength(0);
      expect(mockInsertBadges).not.toHaveBeenCalled();
    });

    it('returns only new badges when some already earned', async () => {
      mockCheckSessionMilestoneBadges.mockReturnValue([
        'first_blood',
        'century_club',
      ]);
      mockFetchUserBadgeIds.mockResolvedValue(new Set(['first_blood']));

      const result = await detectBadges(BASE_INPUT);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('century_club');
    });
  });

  describe('when no badges qualify', () => {
    it('returns empty array', async () => {
      const result = await detectBadges(BASE_INPUT);

      expect(result).toEqual([]);
    });

    it('does not call insertBadges when no new badges', async () => {
      await detectBadges(BASE_INPUT);

      expect(mockInsertBadges).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles empty actualSets without throwing', async () => {
      const input = { ...BASE_INPUT, actualSets: [] };

      await expect(detectBadges(input)).resolves.toEqual([]);
    });

    it('handles null programId without throwing', async () => {
      const input = { ...BASE_INPUT, programId: null };

      await expect(detectBadges(input)).resolves.toEqual([]);
    });

    it('handles null primaryLift without throwing', async () => {
      const input = { ...BASE_INPUT, primaryLift: null };

      await expect(detectBadges(input)).resolves.toEqual([]);
    });

    it('handles zero streakWeeks without throwing', async () => {
      const input = { ...BASE_INPUT, streakWeeks: 0 };

      await expect(detectBadges(input)).resolves.toEqual([]);
    });

    it('uses previousE1Rm from input when building badge context', async () => {
      // Verify the checkers receive the context (they are called once)
      const input = {
        ...BASE_INPUT,
        previousE1Rm: { squat: 150 },
      };

      await detectBadges(input);

      // Each checker should have been called exactly once
      expect(mockCheckPerformanceBadges).toHaveBeenCalledOnce();
      const [ctx] = mockCheckPerformanceBadges.mock.calls[0] as unknown as [
        { previousE1Rm: Record<string, number> },
      ];
      expect(ctx.previousE1Rm).toEqual({ squat: 150 });
    });

    it('passes cycleBadgeEarned as completedCycles=1 to context', async () => {
      const input = { ...BASE_INPUT, cycleBadgeEarned: true };

      await detectBadges(input);

      const [ctx] = mockCheckPerformanceBadges.mock.calls[0] as unknown as [
        { completedCycles: number },
      ];
      expect(ctx.completedCycles).toBe(1);
    });

    it('passes cycleBadgeEarned=false as completedCycles=0 to context', async () => {
      await detectBadges(BASE_INPUT);

      const [ctx] = mockCheckPerformanceBadges.mock.calls[0] as unknown as [
        { completedCycles: number },
      ];
      expect(ctx.completedCycles).toBe(0);
    });

    it('passes streakWeeks through to the badge context', async () => {
      const input = { ...BASE_INPUT, streakWeeks: 12 };

      await detectBadges(input);

      const [ctx] = mockCheckConsistencyBadges.mock.calls[0] as unknown as [
        { streakWeeks: number },
      ];
      expect(ctx.streakWeeks).toBe(12);
    });
  });

  describe('session log handling', () => {
    it('handles missing session log (returns null) without throwing', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'session_logs') {
          return makeChainableQuery({ data: null });
        }
        if (table === 'sessions') {
          return makeChainableQuery({ data: [], count: 0 });
        }
        if (table === 'profiles') {
          return makeChainableQuery({ data: { bodyweight_kg: 80 } });
        }
        if (table === 'personal_records') {
          return makeChainableQuery({ data: [] });
        }
        if (table === 'soreness_checkins') {
          return makeChainableQuery({ data: null });
        }
        if (table === 'disruptions') {
          return makeChainableQuery({ data: [] });
        }
        if (table === 'programs') {
          return makeChainableQuery({ data: [] });
        }
        if (table === 'formula_configs') {
          return makeChainableQuery({ data: null, count: 0 });
        }
        return makeChainableQuery({ data: [] });
      });

      await expect(detectBadges(BASE_INPUT)).resolves.toEqual([]);
    });

    it('builds actualSets context from input sets', async () => {
      const input = {
        ...BASE_INPUT,
        actualSets: [
          {
            weight_grams: 150000,
            reps_completed: 3,
            rpe_actual: 9,
            is_completed: true,
          },
          {
            weight_grams: 150000,
            reps_completed: 3,
            rpe_actual: 9,
            is_completed: true,
          },
        ],
      };

      await detectBadges(input);

      const [ctx] = mockCheckPerformanceBadges.mock.calls[0] as unknown as [
        { actualSets: Array<{ weight_grams: number }> },
      ];
      expect(ctx.actualSets).toHaveLength(2);
      expect(ctx.actualSets[0].weight_grams).toBe(150000);
    });
  });
});

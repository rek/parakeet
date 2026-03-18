export const qk = {
  profile: {
    current: () => ['profile'] as const,
  },
  program: {
    active: (userId?: string) => ['program', 'active', userId] as const,
  },
  session: {
    today: (userId?: string) => ['session', 'today', userId] as const,
    detail: (sessionId: string) => ['session', 'detail', sessionId] as const,
    log: (sessionId: string) => ['session', 'log', sessionId] as const,
  },
  cycleReview: {
    byProgramPrefix: (programId: string) =>
      ['cycle-review', programId] as const,
    byProgram: (programId: string, userId?: string) =>
      ['cycle-review', programId, userId] as const,
  },
  formula: {
    suggestionsCount: (userId?: string) =>
      ['formula', 'suggestions', 'count', userId] as const,
  },
  developer: {
    suggestionsCount: () => ['developer', 'suggestions', 'count'] as const,
  },
  cycle: {
    phase: (userId?: string) => ['cycle', 'phase', userId] as const,
    config: (userId?: string) => ['cycle', 'config', userId] as const,
  },
  bodyweight: {
    history: (userId?: string) => ['bodyweight', 'history', userId] as const,
  },
  featureFlags: {
    all: () => ['feature-flags'] as const,
  },
  weeklyBodyReview: {
    list: (userId?: string) => ['weekly-body-reviews', userId] as const,
    byWeek: (userId?: string, programId?: string, weekNumber?: number) =>
      ['weekly-body-review', userId, programId, weekNumber] as const,
  },
} as const;

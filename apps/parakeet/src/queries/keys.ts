export const qk = {
  profile: {
    current: () => ['profile'] as const,
  },
  program: {
    active: (userId?: string) => ['program', 'active', userId] as const,
  },
  session: {
    today: (userId?: string) => ['session', 'today', userId] as const,
  },
  cycleReview: {
    byProgramPrefix: (programId: string) => ['cycle-review', programId] as const,
    byProgram: (programId: string, userId?: string) => ['cycle-review', programId, userId] as const,
  },
  formula: {
    suggestionsCount: (userId?: string) => ['formula', 'suggestions', 'count', userId] as const,
  },
  developer: {
    suggestionsCount: () => ['developer', 'suggestions', 'count'] as const,
  },
  cycle: {
    phase: (userId?: string) => ['cycle', 'phase', userId] as const,
    config: (userId?: string) => ['cycle', 'config', userId] as const,
  },
} as const;

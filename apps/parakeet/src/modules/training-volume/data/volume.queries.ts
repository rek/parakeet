export const volumeQueries = {
  all: () => ['volume'] as const,
  weekly: (userId: string | undefined, windowStart: string) =>
    [...volumeQueries.all(), 'weekly', userId, windowStart] as const,
  config: (userId: string | undefined) =>
    ['volume', 'config', userId] as const,
};

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  planned: 1,
  completed: 2,
  skipped: 3,
  missed: 4,
}

export function partitionTodaySessions<T extends { status: string }>(
  sessions: T[],
): { completed: T[]; upcoming: T[] } {
  const sorted = [...sessions].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5),
  )
  return {
    completed: sorted.filter((s) => s.status === 'completed'),
    upcoming: sorted.filter((s) => s.status !== 'completed'),
  }
}

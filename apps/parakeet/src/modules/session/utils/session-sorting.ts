const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  planned: 1,
  completed: 2,
  skipped: 3,
  missed: 4,
}

function isAdHoc(s: { program_id?: string | null; primary_lift?: string | null }): boolean {
  return s.program_id === null && !s.primary_lift
}

export function partitionTodaySessions<
  T extends { status: string; program_id?: string | null; primary_lift?: string | null },
>(
  sessions: T[],
): { completed: T[]; upcoming: T[] } {
  const sorted = [...sessions].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5),
  )
  return {
    // Exclude completed ad-hoc — they don't need a "done" card
    completed: sorted.filter((s) => s.status === 'completed' && !isAdHoc(s)),
    // Exclude finished/abandoned ad-hoc from the upcoming list
    upcoming: sorted.filter(
      (s) => s.status !== 'completed' && !(isAdHoc(s) && (s.status === 'skipped' || s.status === 'missed')),
    ),
  }
}

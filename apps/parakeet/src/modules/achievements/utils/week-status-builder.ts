import type { WeekStatus } from '@parakeet/training-engine';

interface SessionRow {
  id: unknown;
  planned_date: unknown;
  status: unknown;
}

interface DisruptionRow {
  affected_date_start: unknown;
  affected_date_end: unknown;
  session_ids_affected: unknown;
}

/**
 * Builds WeekStatus[] from raw session + disruption rows.
 * Shared between streak computation and streak-break-and-rebuild detection.
 */
export function buildWeekStatuses(
  sessions: SessionRow[],
  disruptions: DisruptionRow[],
  todayStr: string
): WeekStatus[] {
  const disruptionSessionIds = new Set<string>();
  for (const d of disruptions) {
    const ids = d.session_ids_affected as string[] | null;
    if (ids) for (const id of ids) disruptionSessionIds.add(id);
  }

  function isDateCoveredByDisruption(dateStr: string): boolean {
    for (const d of disruptions) {
      const start = d.affected_date_start as string;
      const end = (d.affected_date_end as string | null) ?? start;
      if (dateStr >= start && dateStr <= end) return true;
    }
    return false;
  }

  const byWeek = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const d = new Date(s.planned_date as string);
    const day = d.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + offset);
    const weekKey = monday.toISOString().split('T')[0];
    const existing = byWeek.get(weekKey) ?? [];
    existing.push(s);
    byWeek.set(weekKey, existing);
  }

  const weekStatuses: WeekStatus[] = [];
  for (const [weekStartDate, weekSessions] of [...byWeek.entries()].sort()) {
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    const weekIsComplete = weekEndStr < todayStr;

    let scheduled = 0;
    let completed = 0;
    let skippedWithDisruption = 0;
    let unaccountedMisses = 0;

    for (const s of weekSessions) {
      const status = s.status as string;
      const dateStr = s.planned_date as string;
      if (dateStr > todayStr && status === 'planned') continue;

      scheduled++;
      if (status === 'completed') {
        completed++;
      } else if (
        status === 'skipped' &&
        (disruptionSessionIds.has(s.id as string) ||
          isDateCoveredByDisruption(dateStr))
      ) {
        skippedWithDisruption++;
      } else if (weekIsComplete) {
        unaccountedMisses++;
      }
    }

    if (scheduled > 0) {
      weekStatuses.push({
        weekStartDate,
        scheduled,
        completed,
        skippedWithDisruption,
        unaccountedMisses,
      });
    }
  }

  return weekStatuses;
}

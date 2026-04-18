import { describe, expect, it } from 'vitest';

import { buildWeekStatuses } from './week-status-builder';

type Session = Parameters<typeof buildWeekStatuses>[0][number];
type Disruption = Parameters<typeof buildWeekStatuses>[1][number];

function session(
  id: string,
  planned_date: string,
  status: Session['status']
): Session {
  return { id, planned_date, status };
}

describe('buildWeekStatuses', () => {
  it('excludes the current in-progress week entirely', () => {
    const today = '2026-04-15'; // Wednesday
    const sessions: Session[] = [
      session('a', '2026-04-13', 'completed'), // Mon, completed
      session('b', '2026-04-15', 'completed'), // Wed, completed
      session('c', '2026-04-17', 'planned'), // Fri, future — filtered
    ];
    const result = buildWeekStatuses(sessions, [], today);
    expect(result).toEqual([]);
  });

  it('emits a completed past week with all sessions done', () => {
    const today = '2026-04-15';
    const sessions: Session[] = [
      session('a', '2026-04-06', 'completed'),
      session('b', '2026-04-08', 'completed'),
      session('c', '2026-04-10', 'completed'),
    ];
    const result = buildWeekStatuses(sessions, [], today);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      scheduled: 3,
      completed: 3,
      skippedWithDisruption: 0,
      unaccountedMisses: 0,
    });
  });

  it('past week with unaccounted skip → unaccountedMisses = 1', () => {
    const today = '2026-04-15';
    const sessions: Session[] = [
      session('a', '2026-04-06', 'completed'),
      session('b', '2026-04-08', 'skipped'),
      session('c', '2026-04-10', 'completed'),
    ];
    const result = buildWeekStatuses(sessions, [], today);
    expect(result[0]).toMatchObject({
      scheduled: 3,
      completed: 2,
      skippedWithDisruption: 0,
      unaccountedMisses: 1,
    });
  });

  it('past week with disruption-covered skip → counted as disruption', () => {
    const today = '2026-04-15';
    const sessions: Session[] = [
      session('a', '2026-04-06', 'completed'),
      session('b', '2026-04-08', 'skipped'),
      session('c', '2026-04-10', 'completed'),
    ];
    const disruptions: Disruption[] = [
      {
        affected_date_start: '2026-04-08',
        affected_date_end: '2026-04-08',
        session_ids_affected: null,
      },
    ];
    const result = buildWeekStatuses(sessions, disruptions, today);
    expect(result[0]).toMatchObject({
      scheduled: 3,
      completed: 2,
      skippedWithDisruption: 1,
      unaccountedMisses: 0,
    });
  });
});

// @spec docs/features/auxiliary-exercises/spec-history-anchored-weight.md
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAuxHistory } from './jit.repository';

const fromMock = vi.hoisted(() => vi.fn());
const getSessionSetsBySessionIdsMock = vi.hoisted(() => vi.fn());
const addBreadcrumbMock = vi.hoisted(() => vi.fn());

vi.mock('@platform/supabase', () => ({
  typedSupabase: { from: fromMock },
}));

vi.mock('@modules/session', () => ({
  getSessionSetsBySessionIds: getSessionSetsBySessionIdsMock,
}));

vi.mock('@platform/utils/captureException', () => ({
  addBreadcrumb: addBreadcrumbMock,
}));

function makeOrderedSessionLogs(rows: Array<{ id: string; date: string }>) {
  // session_logs query: from().select().eq().order().limit() — last call resolves.
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockResolvedValue({
    data: rows.map((r) => ({ session_id: r.id, completed_at: r.date })),
    error: null,
  });
  return chain;
}

function makeSessionTraces(traces: Array<{ id: string; trace: unknown }>) {
  // sessions query: from().select().in() — `.in` resolves.
  const chain = {
    select: vi.fn(),
    in: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.in.mockResolvedValue({
    data: traces.map((t) => ({ id: t.id, jit_output_trace: t.trace })),
    error: null,
  });
  return chain;
}

interface FakeSetLog {
  set_number: number;
  weight_grams: number;
  reps_completed: number;
  exercise?: string;
  exercise_slug?: string;
  rpe_actual?: number;
}

function setsBucket(auxRows: FakeSetLog[]) {
  return {
    primary: [],
    auxiliary: auxRows,
    containedRehabSets: false,
  };
}

function buildTrace(auxes: Array<{ exercise: string; finalWeightKg: number }>) {
  return {
    auxiliaries: auxes.map((a) => ({
      exercise: a.exercise,
      weightTrace: { finalWeightKg: a.finalWeightKg },
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fromMock.mockReset();
  getSessionSetsBySessionIdsMock.mockReset();
  addBreadcrumbMock.mockReset();
});

describe('fetchAuxHistory', () => {
  it('returns newest-first ≤ sessionLimit entries per exercise (capped at the limit)', async () => {
    const sessions = [
      { id: 's1', date: '2026-05-20T10:00:00Z' }, // newest
      { id: 's2', date: '2026-05-13T10:00:00Z' },
      { id: 's3', date: '2026-05-06T10:00:00Z' },
      { id: 's4', date: '2026-04-29T10:00:00Z' }, // would be 4th — must be excluded
    ];
    const setsBySession = new Map([
      [
        's1',
        setsBucket([
          {
            set_number: 1,
            weight_grams: 90000,
            reps_completed: 8,
            exercise_slug: 'close-grip-barbell-bench-press',
            exercise: 'Close-Grip Barbell Bench Press',
          },
        ]),
      ],
      [
        's2',
        setsBucket([
          {
            set_number: 1,
            weight_grams: 85000,
            reps_completed: 8,
            exercise_slug: 'close-grip-barbell-bench-press',
            exercise: 'Close-Grip Barbell Bench Press',
          },
        ]),
      ],
      [
        's3',
        setsBucket([
          {
            set_number: 1,
            weight_grams: 80000,
            reps_completed: 8,
            exercise_slug: 'close-grip-barbell-bench-press',
            exercise: 'Close-Grip Barbell Bench Press',
          },
        ]),
      ],
      [
        's4',
        setsBucket([
          {
            set_number: 1,
            weight_grams: 75000,
            reps_completed: 8,
            exercise_slug: 'close-grip-barbell-bench-press',
            exercise: 'Close-Grip Barbell Bench Press',
          },
        ]),
      ],
    ]);
    const trace = buildTrace([
      { exercise: 'Close-Grip Barbell Bench Press', finalWeightKg: 90 },
    ]);

    fromMock
      .mockReturnValueOnce(makeOrderedSessionLogs(sessions))
      .mockReturnValueOnce(
        makeSessionTraces(sessions.map((s) => ({ id: s.id, trace })))
      );
    getSessionSetsBySessionIdsMock.mockResolvedValue(setsBySession);

    const result = await fetchAuxHistory(
      'user-1',
      ['Close-Grip Barbell Bench Press'],
      3
    );

    expect(result['close-grip-barbell-bench-press']).toBeDefined();
    expect(result['close-grip-barbell-bench-press']).toHaveLength(3);
    expect(
      result['close-grip-barbell-bench-press'].map((e) => e.sessionId)
    ).toEqual(['s1', 's2', 's3']);
  });

  it('skips sessions whose set_logs contain no rows matching the wanted slugs', async () => {
    const sessions = [
      { id: 's1', date: '2026-05-20T10:00:00Z' },
      { id: 's2', date: '2026-05-13T10:00:00Z' },
    ];
    const setsBySession = new Map([
      [
        's1',
        setsBucket([
          {
            set_number: 1,
            weight_grams: 90000,
            reps_completed: 8,
            exercise_slug: 'leg-press', // a different exercise
            exercise: 'Leg Press',
          },
        ]),
      ],
      [
        's2',
        setsBucket([
          {
            set_number: 1,
            weight_grams: 85000,
            reps_completed: 8,
            exercise_slug: 'close-grip-barbell-bench-press',
            exercise: 'Close-Grip Barbell Bench Press',
          },
        ]),
      ],
    ]);
    const trace = buildTrace([
      { exercise: 'Close-Grip Barbell Bench Press', finalWeightKg: 90 },
    ]);

    fromMock
      .mockReturnValueOnce(makeOrderedSessionLogs(sessions))
      .mockReturnValueOnce(
        makeSessionTraces(sessions.map((s) => ({ id: s.id, trace })))
      );
    getSessionSetsBySessionIdsMock.mockResolvedValue(setsBySession);

    const result = await fetchAuxHistory(
      'user-1',
      ['Close-Grip Barbell Bench Press'],
      3
    );

    // Only s2 has matching sets — s1 is skipped.
    expect(result['close-grip-barbell-bench-press']).toHaveLength(1);
    expect(result['close-grip-barbell-bench-press'][0].sessionId).toBe('s2');
    // Wrong-slug session never appears in the result keyed by anything else.
    expect(result['leg-press']).toBeUndefined();
  });

  it('produces null prescribedWeightKg + emits breadcrumb when trace is missing the exercise', async () => {
    const sessions = [{ id: 's1', date: '2026-05-20T10:00:00Z' }];
    const setsBySession = new Map([
      [
        's1',
        setsBucket([
          {
            set_number: 1,
            weight_grams: 90000,
            reps_completed: 8,
            exercise_slug: 'close-grip-barbell-bench-press',
            exercise: 'Close-Grip Barbell Bench Press',
          },
        ]),
      ],
    ]);

    fromMock
      .mockReturnValueOnce(makeOrderedSessionLogs(sessions))
      .mockReturnValueOnce(
        // Trace exists but doesn't include this exercise.
        makeSessionTraces([{ id: 's1', trace: { auxiliaries: [] } }])
      );
    getSessionSetsBySessionIdsMock.mockResolvedValue(setsBySession);

    const result = await fetchAuxHistory(
      'user-1',
      ['Close-Grip Barbell Bench Press'],
      3
    );

    expect(result['close-grip-barbell-bench-press']).toHaveLength(1);
    expect(
      result['close-grip-barbell-bench-press'][0].prescribedWeightKg
    ).toBeNull();
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      'aux-anchor',
      'missing prescribed weight in trace',
      expect.objectContaining({
        slug: 'close-grip-barbell-bench-press',
        sessionId: 's1',
      })
    );
  });
});

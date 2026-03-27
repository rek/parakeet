import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  findTodaySession,
  findTodaySessions,
  getInProgressSession,
} from './session.service';

// ── Mocks ────────────────────────────────────────────────────────────────────
// Only the exports actually called by findTodaySession, findTodaySessions,
// and getInProgressSession. Factory mocks are required because path aliases
// (@platform/supabase etc.) can't resolve in the test environment for automock.

const mockFetchTodaySession = vi.hoisted(() => vi.fn());
const mockFetchTodaySessions = vi.hoisted(() => vi.fn());
const mockFetchInProgressSession = vi.hoisted(() => vi.fn());
const mockFetchPlannedSessionForProgram = vi.hoisted(() => vi.fn());
const mockFetchActiveProgramMode = vi.hoisted(() => vi.fn());
const mockCaptureException = vi.hoisted(() => vi.fn());
const mockNextTrainingDate = vi.hoisted(() =>
  vi.fn((_days: number[]) => '2026-03-09')
);

const mockFetchLastCompletedLiftForProgram = vi.hoisted(() => vi.fn());
const mockFetchHasCompletedSessionToday = vi.hoisted(() => vi.fn());

vi.mock('../data/session.repository', () => ({
  fetchTodaySession: mockFetchTodaySession,
  fetchTodaySessions: mockFetchTodaySessions,
  fetchInProgressSession: mockFetchInProgressSession,
  fetchPlannedSessionForProgram: mockFetchPlannedSessionForProgram,
  fetchLastCompletedLiftForProgram: mockFetchLastCompletedLiftForProgram,
  fetchHasCompletedSessionToday: mockFetchHasCompletedSessionToday,
}));

vi.mock('@modules/program', () => ({
  fetchActiveProgramMode: mockFetchActiveProgramMode,
  appendNextUnendingSession: vi.fn(),
}));

vi.mock('@platform/utils/captureException', () => ({
  captureException: mockCaptureException,
}));

vi.mock('@parakeet/training-engine', () => ({
  DEFAULT_TRAINING_DAYS: { 3: [1, 3, 5] },
  LIFTS: ['squat', 'bench', 'deadlift'],
  nextTrainingDate: mockNextTrainingDate,
  localDateString: () => '2026-03-09',
  getDefaultThresholds: () => ({}),
  isMakeupWindowExpired: () => false,
  suggestProgramAdjustments: () => [],
}));

vi.mock('@parakeet/shared-types', () => ({
  MUSCLE_GROUPS: [],
  MUSCLE_CATALOG: [],
  LiftSchema: { parse: (v: string) => v },
  IntensityTypeSchema: { parse: (v: string) => v },
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('findTodaySession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns in_progress session for scheduled program', async () => {
    const session = {
      id: 's1',
      status: 'in_progress',
      planned_date: '2026-03-08',
    };
    mockFetchTodaySession.mockResolvedValue(session);
    mockFetchActiveProgramMode.mockResolvedValue({
      id: 'p1',
      program_mode: 'scheduled',
    });

    const result = await findTodaySession('user-1');

    expect(result).toEqual(session);
  });

  it('returns null when no sessions exist', async () => {
    mockFetchTodaySession.mockResolvedValue(null);
    mockFetchActiveProgramMode.mockResolvedValue({
      id: 'p1',
      program_mode: 'scheduled',
    });

    const result = await findTodaySession('user-1');

    expect(result).toBeNull();
  });

  it('generates next session for unending program when none exists', async () => {
    const generated = { id: 's2', status: 'planned' };
    mockFetchTodaySession.mockResolvedValue(null);
    mockFetchActiveProgramMode.mockResolvedValue({
      id: 'p1',
      program_mode: 'unending',
      training_days_per_week: 3,
      training_days: null,
      unending_session_counter: 5,
    });
    mockFetchHasCompletedSessionToday.mockResolvedValue(false);
    mockFetchPlannedSessionForProgram
      .mockResolvedValueOnce(null) // guard check
      .mockResolvedValueOnce(generated) // inside generateNextUnendingSession
      .mockResolvedValueOnce(generated); // final return after generation

    const result = await findTodaySession('user-1');

    expect(result).toEqual(generated);
  });

  it('generates next session without skipToday ref when no session completed today', async () => {
    const generated = { id: 's2', status: 'planned' };
    mockFetchTodaySession.mockResolvedValue(null);
    mockFetchActiveProgramMode.mockResolvedValue({
      id: 'p1',
      program_mode: 'unending',
      training_days_per_week: 3,
      training_days: [1, 3, 5],
      unending_session_counter: 2,
    });
    mockFetchHasCompletedSessionToday.mockResolvedValue(false);
    mockFetchPlannedSessionForProgram
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(generated)
      .mockResolvedValueOnce(generated);

    await findTodaySession('user-1');

    // No session completed today — nextTrainingDate may return today
    expect(mockNextTrainingDate).toHaveBeenCalledWith([1, 3, 5], undefined);
  });

  it('skips today when generating next session after completing one today (GH#136)', async () => {
    const completedSession = {
      id: 's1',
      status: 'completed',
      planned_date: '2026-03-09',
    };
    const generated = { id: 's2', status: 'planned' };
    mockFetchTodaySession.mockResolvedValue(completedSession);
    mockFetchActiveProgramMode.mockResolvedValue({
      id: 'p1',
      program_mode: 'unending',
      training_days_per_week: 3,
      training_days: [1, 3, 5],
      unending_session_counter: 3,
    });
    mockFetchHasCompletedSessionToday.mockResolvedValue(true);
    mockFetchPlannedSessionForProgram
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(generated)
      .mockResolvedValueOnce(generated);

    await findTodaySession('user-1');

    // Session completed today — nextTrainingDate called with tomorrow ref
    expect(mockNextTrainingDate).toHaveBeenCalledWith(
      [1, 3, 5],
      expect.any(Date)
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const refDate = (mockNextTrainingDate.mock.calls[0] as any)[1] as Date;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(refDate.toDateString()).toBe(tomorrow.toDateString());
  });

  it('returns existing planned session for unending program without generating', async () => {
    const existing = { id: 's3', status: 'planned' };
    mockFetchTodaySession.mockResolvedValue(null);
    mockFetchActiveProgramMode.mockResolvedValue({
      id: 'p1',
      program_mode: 'unending',
      training_days_per_week: 3,
      training_days: null,
      unending_session_counter: 5,
    });
    mockFetchPlannedSessionForProgram.mockResolvedValue(existing);

    const result = await findTodaySession('user-1');

    expect(result).toEqual(existing);
  });
});

describe('findTodaySessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns sessions from repository for scheduled program', async () => {
    const sessions = [
      { id: 's1', status: 'planned', planned_date: '2026-03-08' },
    ];
    mockFetchActiveProgramMode.mockResolvedValue({
      id: 'p1',
      program_mode: 'scheduled',
    });
    mockFetchTodaySessions.mockResolvedValue(sessions);

    const result = await findTodaySessions('user-1');

    expect(result).toEqual(sessions);
    expect(mockFetchTodaySessions).toHaveBeenCalledWith('user-1');
  });

  it('still returns sessions when fetchActiveProgramMode throws', async () => {
    const sessions = [
      { id: 's1', status: 'in_progress', planned_date: '2026-03-08' },
    ];
    mockFetchActiveProgramMode.mockRejectedValue(
      new Error('multiple rows returned for maybeSingle')
    );
    mockFetchTodaySessions.mockResolvedValue(sessions);

    const result = await findTodaySessions('user-1');

    expect(result).toEqual(sessions);
    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error));
    expect(mockFetchTodaySessions).toHaveBeenCalledWith('user-1');
  });

  it('still returns sessions when unending lazy generation throws', async () => {
    const sessions = [
      { id: 's1', status: 'planned', planned_date: '2026-03-08' },
    ];
    mockFetchActiveProgramMode.mockResolvedValue({
      id: 'p1',
      program_mode: 'unending',
      training_days_per_week: 3,
      training_days: null,
      unending_session_counter: 5,
    });
    // findTodaySession (called for unending) will throw because fetchTodaySession
    // is needed inside it — mock it to throw
    mockFetchTodaySession.mockRejectedValue(new Error('generation failed'));
    mockFetchTodaySessions.mockResolvedValue(sessions);

    const result = await findTodaySessions('user-1');

    expect(result).toEqual(sessions);
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it('returns nearest planned session for unending program when no sessions match today', async () => {
    const futureSession = {
      id: 's-next',
      status: 'planned',
      planned_date: '2026-03-14',
    };
    mockFetchActiveProgramMode.mockResolvedValue({
      id: 'p1',
      program_mode: 'unending',
      training_days_per_week: 3,
      training_days: null,
      unending_session_counter: 5,
    });
    // findTodaySession path: no existing session → guard returns null → generate → return planned
    mockFetchTodaySession.mockResolvedValue(null);
    mockFetchHasCompletedSessionToday.mockResolvedValue(false);
    mockFetchPlannedSessionForProgram
      .mockResolvedValueOnce(null) // guard check
      .mockResolvedValueOnce(futureSession) // inside generateNextUnendingSession
      .mockResolvedValueOnce(futureSession); // final return after generation
    // fetchTodaySessions returns empty — session is for a future date
    mockFetchTodaySessions.mockResolvedValue([]);

    const result = await findTodaySessions('user-1');

    expect(result).toEqual([futureSession]);
  });

  it('does not duplicate sessions when fetchTodaySessions already includes the planned session', async () => {
    const plannedSession = {
      id: 's-today',
      status: 'planned',
      planned_date: '2026-03-11',
    };
    mockFetchActiveProgramMode.mockResolvedValue({
      id: 'p1',
      program_mode: 'unending',
      training_days_per_week: 3,
      training_days: null,
      unending_session_counter: 5,
    });
    mockFetchTodaySession.mockResolvedValue(null);
    mockFetchPlannedSessionForProgram.mockResolvedValue(plannedSession);
    // fetchTodaySessions already includes this session (planned_date = today)
    mockFetchTodaySessions.mockResolvedValue([plannedSession]);

    const result = await findTodaySessions('user-1');

    expect(result).toEqual([plannedSession]);
  });

  it('returns sessions when no active program exists', async () => {
    const sessions = [
      { id: 's1', status: 'planned', planned_date: '2026-03-08' },
    ];
    mockFetchActiveProgramMode.mockResolvedValue(null);
    mockFetchTodaySessions.mockResolvedValue(sessions);

    const result = await findTodaySessions('user-1');

    expect(result).toEqual(sessions);
  });
});

describe('getInProgressSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns session id when one exists', async () => {
    mockFetchInProgressSession.mockResolvedValue({ id: 's1' });

    const result = await getInProgressSession('user-1');

    expect(result).toEqual({ id: 's1' });
  });

  it('returns null when no in-progress session exists', async () => {
    mockFetchInProgressSession.mockResolvedValue(null);

    const result = await getInProgressSession('user-1');

    expect(result).toBeNull();
  });
});

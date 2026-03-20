// session.repository.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchInProgressSession,
  fetchTodaySession,
  fetchTodaySessions,
} from './session.repository';

const fromMock = vi.hoisted(() => vi.fn());

// @sentry/react-native transitively imports react-native which uses Flow syntax
// that Rollup cannot parse. Mock it to prevent the parse failure.
vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
}));

vi.mock('@platform/supabase', () => ({
  typedSupabase: {
    from: fromMock,
  },
}));

describe('fetchTodaySession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createQueryChain() {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      not: vi.fn(),
      gte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.not.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    return chain;
  }

  it('returns in_progress session immediately without checking further', async () => {
    const inProgress = { id: 'in-progress-1' };
    const inProgressChain = createQueryChain();
    inProgressChain.maybeSingle.mockResolvedValue({
      data: inProgress,
      error: null,
    });
    fromMock.mockReturnValueOnce(inProgressChain);

    const result = await fetchTodaySession('user-1');

    expect(result).toEqual(inProgress);
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(inProgressChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(inProgressChain.eq).toHaveBeenCalledWith('status', 'in_progress');
    expect(inProgressChain.not).toHaveBeenCalledWith(
      'planned_date',
      'is',
      null
    );
    expect(inProgressChain.order).toHaveBeenCalledWith('planned_date', {
      ascending: true,
    });
    expect(inProgressChain.limit).toHaveBeenCalledWith(1);
  });

  it('returns completed-today session when no in_progress session exists', async () => {
    const completedToday = { id: 'completed-today-1', status: 'completed' };
    const inProgressChain = createQueryChain();
    const completedTodayChain = createQueryChain();
    inProgressChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    completedTodayChain.maybeSingle.mockResolvedValue({
      data: completedToday,
      error: null,
    });
    fromMock
      .mockReturnValueOnce(inProgressChain)
      .mockReturnValueOnce(completedTodayChain);

    const result = await fetchTodaySession('user-1');

    expect(result).toEqual(completedToday);
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(completedTodayChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(completedTodayChain.eq).toHaveBeenCalledWith('status', 'completed');
    expect(completedTodayChain.eq).toHaveBeenCalledWith(
      'planned_date',
      expect.any(String)
    );
    expect(completedTodayChain.order).toHaveBeenCalledWith('completed_at', {
      ascending: false,
    });
    expect(completedTodayChain.limit).toHaveBeenCalledWith(1);
  });

  it('falls back to nearest planned session when no in_progress or completed-today session exists', async () => {
    const planned = { id: 'planned-1' };
    const inProgressChain = createQueryChain();
    const completedTodayChain = createQueryChain();
    const plannedChain = createQueryChain();
    inProgressChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    completedTodayChain.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    plannedChain.maybeSingle.mockResolvedValue({ data: planned, error: null });
    fromMock
      .mockReturnValueOnce(inProgressChain)
      .mockReturnValueOnce(completedTodayChain)
      .mockReturnValueOnce(plannedChain);

    const result = await fetchTodaySession('user-1');

    expect(result).toEqual(planned);
    expect(fromMock).toHaveBeenCalledTimes(3);
    expect(plannedChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(plannedChain.eq).toHaveBeenCalledWith('status', 'planned');
    expect(plannedChain.not).toHaveBeenCalledWith('planned_date', 'is', null);
    expect(plannedChain.order).toHaveBeenCalledWith('planned_date', {
      ascending: true,
    });
    expect(plannedChain.limit).toHaveBeenCalledWith(1);
  });

  it('returns null when no sessions exist', async () => {
    const inProgressChain = createQueryChain();
    const completedTodayChain = createQueryChain();
    const plannedChain = createQueryChain();
    inProgressChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    completedTodayChain.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    plannedChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    fromMock
      .mockReturnValueOnce(inProgressChain)
      .mockReturnValueOnce(completedTodayChain)
      .mockReturnValueOnce(plannedChain);

    const result = await fetchTodaySession('user-1');

    expect(result).toBeNull();
    expect(fromMock).toHaveBeenCalledTimes(3);
  });

  it('throws when in_progress query fails', async () => {
    const error = new Error('in-progress query failed');
    const inProgressChain = createQueryChain();
    inProgressChain.maybeSingle.mockResolvedValue({ data: null, error });
    fromMock.mockReturnValueOnce(inProgressChain);

    await expect(fetchTodaySession('user-1')).rejects.toThrow(
      'in-progress query failed'
    );
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('throws when completed-today query fails', async () => {
    const error = new Error('completed-today query failed');
    const inProgressChain = createQueryChain();
    const completedTodayChain = createQueryChain();
    inProgressChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    completedTodayChain.maybeSingle.mockResolvedValue({ data: null, error });
    fromMock
      .mockReturnValueOnce(inProgressChain)
      .mockReturnValueOnce(completedTodayChain);

    await expect(fetchTodaySession('user-1')).rejects.toThrow(
      'completed-today query failed'
    );
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it('throws when planned fallback query fails', async () => {
    const error = new Error('planned query failed');
    const inProgressChain = createQueryChain();
    const completedTodayChain = createQueryChain();
    const plannedChain = createQueryChain();
    inProgressChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    completedTodayChain.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    plannedChain.maybeSingle.mockResolvedValue({ data: null, error });
    fromMock
      .mockReturnValueOnce(inProgressChain)
      .mockReturnValueOnce(completedTodayChain)
      .mockReturnValueOnce(plannedChain);

    await expect(fetchTodaySession('user-1')).rejects.toThrow(
      'planned query failed'
    );
    expect(fromMock).toHaveBeenCalledTimes(3);
  });
});

describe('fetchTodaySessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createListChain() {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      or: vi.fn(),
      order: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.or.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    return chain;
  }

  it('returns sessions matching today or in_progress', async () => {
    const sessions = [
      { id: 's1', status: 'planned', planned_date: '2026-03-08' },
      { id: 's2', status: 'in_progress', planned_date: '2026-03-07' },
    ];
    const chain = createListChain();
    chain.order.mockResolvedValue({ data: sessions, error: null });
    fromMock.mockReturnValueOnce(chain);

    const result = await fetchTodaySessions('user-1');

    expect(result).toEqual(sessions);
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.or).toHaveBeenCalledWith(
      expect.stringContaining('status.eq.in_progress')
    );
  });

  it('deduplicates sessions that match both conditions', async () => {
    const sessions = [
      { id: 's1', status: 'in_progress', planned_date: '2026-03-08' },
      { id: 's1', status: 'in_progress', planned_date: '2026-03-08' },
    ];
    const chain = createListChain();
    chain.order.mockResolvedValue({ data: sessions, error: null });
    fromMock.mockReturnValueOnce(chain);

    const result = await fetchTodaySessions('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });

  it('returns empty array when no sessions match', async () => {
    const chain = createListChain();
    chain.order.mockResolvedValue({ data: [], error: null });
    fromMock.mockReturnValueOnce(chain);

    const result = await fetchTodaySessions('user-1');

    expect(result).toEqual([]);
  });

  it('throws when query fails', async () => {
    const chain = createListChain();
    chain.order.mockResolvedValue({
      data: null,
      error: new Error('query failed'),
    });
    fromMock.mockReturnValueOnce(chain);

    await expect(fetchTodaySessions('user-1')).rejects.toThrow('query failed');
  });
});

describe('fetchInProgressSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createQueryChain() {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    return chain;
  }

  it('returns session id when one is in progress', async () => {
    const chain = createQueryChain();
    chain.maybeSingle.mockResolvedValue({ data: { id: 's1' }, error: null });
    fromMock.mockReturnValueOnce(chain);

    const result = await fetchInProgressSession('user-1');

    expect(result).toEqual({ id: 's1' });
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.eq).toHaveBeenCalledWith('status', 'in_progress');
  });

  it('returns null when no session is in progress', async () => {
    const chain = createQueryChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValueOnce(chain);

    const result = await fetchInProgressSession('user-1');

    expect(result).toBeNull();
  });

  it('throws when query fails', async () => {
    const chain = createQueryChain();
    chain.maybeSingle.mockResolvedValue({
      data: null,
      error: new Error('query failed'),
    });
    fromMock.mockReturnValueOnce(chain);

    await expect(fetchInProgressSession('user-1')).rejects.toThrow(
      'query failed'
    );
  });
});

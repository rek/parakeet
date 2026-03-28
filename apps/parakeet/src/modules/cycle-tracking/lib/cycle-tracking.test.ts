import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addPeriodStart,
  deletePeriodStart,
  getCycleConfig,
  getCurrentCycleContext,
  getPeriodStartHistory,
  stampCyclePhaseOnSession,
  updateCycleConfig,
} from './cycle-tracking';

// ── Mocks ────────────────────────────────────────────────────────────────────

const fromMock = vi.hoisted(() => vi.fn());
const mockComputeCyclePhase = vi.hoisted(() => vi.fn());

vi.mock('@platform/supabase', () => ({
  typedSupabase: {
    from: fromMock,
  },
}));

vi.mock('@parakeet/training-engine', () => ({
  computeCyclePhase: mockComputeCyclePhase,
  getCyclePhaseModifier: vi.fn(),
  getPhaseForDay: vi.fn(),
}));

// ── Chain builders ────────────────────────────────────────────────────────────

/** Single-row chain ending in .maybeSingle() */
function makeSingleChain(result: unknown) {
  const chain = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    order: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result);
  chain.insert.mockResolvedValue({ error: null });
  chain.upsert.mockResolvedValue({ error: null });
  chain.update.mockResolvedValue({ error: null });
  chain.delete.mockReturnValue(chain);
  return chain;
}

/** List chain ending in .order() returning data array */
function makeListChain(result: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.order.mockResolvedValue(result);
  chain.upsert.mockResolvedValue({ error: null });
  return chain;
}

/** Upsert chain (for updateCycleConfig) */
function makeUpsertChain(result: unknown = { error: null }) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    upsert: vi.fn(),
    insert: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.upsert.mockResolvedValue(result);
  chain.insert.mockResolvedValue(result);
  return chain;
}

const USER_ID = 'user-1';

// ── getCycleConfig ─────────────────────────────────────────────────────────────

describe('getCycleConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns existing config from DB when row exists', async () => {
    const dbRow = {
      is_enabled: true,
      cycle_length_days: 30,
      last_period_start: '2026-03-01',
    };
    fromMock.mockReturnValueOnce(makeSingleChain({ data: dbRow, error: null }));

    const result = await getCycleConfig(USER_ID);

    expect(result).toEqual({
      is_enabled: true,
      cycle_length_days: 30,
      last_period_start: '2026-03-01',
    });
  });

  it('normalises null last_period_start to null', async () => {
    const dbRow = { is_enabled: false, cycle_length_days: 28, last_period_start: null };
    fromMock.mockReturnValueOnce(makeSingleChain({ data: dbRow, error: null }));

    const result = await getCycleConfig(USER_ID);

    expect(result.last_period_start).toBeNull();
  });

  it('inserts and returns defaults when no row exists', async () => {
    // First call: select → null
    const selectChain = makeSingleChain({ data: null, error: null });
    // Second call: insert
    const insertChain = makeUpsertChain({ error: null });
    fromMock
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertChain);

    const result = await getCycleConfig(USER_ID);

    expect(result).toEqual({
      is_enabled: false,
      cycle_length_days: 28,
      last_period_start: null,
    });
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it('throws when the select query fails', async () => {
    fromMock.mockReturnValueOnce(makeSingleChain({ data: null, error: new Error('db error') }));

    await expect(getCycleConfig(USER_ID)).rejects.toThrow('db error');
  });

  it('throws when the insert fails on first-time setup', async () => {
    const selectChain = makeSingleChain({ data: null, error: null });
    const insertChain = makeUpsertChain({ error: new Error('insert failed') });
    fromMock
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertChain);

    await expect(getCycleConfig(USER_ID)).rejects.toThrow('insert failed');
  });
});

// ── updateCycleConfig ──────────────────────────────────────────────────────────

describe('updateCycleConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts the provided partial update', async () => {
    const chain = makeUpsertChain({ error: null });
    fromMock.mockReturnValueOnce(chain);

    await updateCycleConfig(USER_ID, { is_enabled: true, cycle_length_days: 30 });

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, is_enabled: true, cycle_length_days: 30 }),
      { onConflict: 'user_id' }
    );
  });

  it('throws when upsert fails', async () => {
    const chain = makeUpsertChain({ error: new Error('upsert error') });
    fromMock.mockReturnValueOnce(chain);

    await expect(updateCycleConfig(USER_ID, { is_enabled: false })).rejects.toThrow('upsert error');
  });
});

// ── getCurrentCycleContext ─────────────────────────────────────────────────────

describe('getCurrentCycleContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when cycle tracking is disabled', async () => {
    fromMock.mockReturnValueOnce(
      makeSingleChain({ data: { is_enabled: false, cycle_length_days: 28, last_period_start: '2026-03-01' }, error: null })
    );

    const result = await getCurrentCycleContext(USER_ID);

    expect(result).toBeNull();
    expect(mockComputeCyclePhase).not.toHaveBeenCalled();
  });

  it('returns null when last_period_start is null', async () => {
    fromMock.mockReturnValueOnce(
      makeSingleChain({ data: { is_enabled: true, cycle_length_days: 28, last_period_start: null }, error: null })
    );

    const result = await getCurrentCycleContext(USER_ID);

    expect(result).toBeNull();
    expect(mockComputeCyclePhase).not.toHaveBeenCalled();
  });

  it('computes and returns cycle context when enabled with a period start', async () => {
    fromMock.mockReturnValueOnce(
      makeSingleChain({
        data: { is_enabled: true, cycle_length_days: 28, last_period_start: '2026-03-01' },
        error: null,
      })
    );
    const expectedContext = {
      phase: 'follicular',
      dayOfCycle: 8,
      daysUntilNextPeriod: 20,
      isOvulatoryWindow: false,
      isLateLuteal: false,
    };
    mockComputeCyclePhase.mockReturnValue(expectedContext);

    const result = await getCurrentCycleContext(USER_ID);

    expect(result).toEqual(expectedContext);
    expect(mockComputeCyclePhase).toHaveBeenCalledWith(
      new Date('2026-03-01'),
      28
    );
  });
});

// ── getPeriodStartHistory ──────────────────────────────────────────────────────

describe('getPeriodStartHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns period start history ordered by start_date descending', async () => {
    const history = [
      { id: 'e2', start_date: '2026-03-01' },
      { id: 'e1', start_date: '2026-02-01' },
    ];
    fromMock.mockReturnValueOnce(makeListChain({ data: history, error: null }));

    const result = await getPeriodStartHistory(USER_ID);

    expect(result).toEqual(history);
  });

  it('returns empty array when no history exists', async () => {
    fromMock.mockReturnValueOnce(makeListChain({ data: null, error: null }));

    const result = await getPeriodStartHistory(USER_ID);

    expect(result).toEqual([]);
  });

  it('throws when query fails', async () => {
    fromMock.mockReturnValueOnce(makeListChain({ data: null, error: new Error('query failed') }));

    await expect(getPeriodStartHistory(USER_ID)).rejects.toThrow('query failed');
  });
});

// ── addPeriodStart ─────────────────────────────────────────────────────────────

describe('addPeriodStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts the period start, refreshes history, and updates last_period_start in config', async () => {
    const history = [
      { id: 'e2', start_date: '2026-03-15' },
      { id: 'e1', start_date: '2026-03-01' },
    ];

    // Call sequence:
    // 1. upsert into period_starts
    // 2. select from period_starts (getPeriodStartHistory)
    // 3. upsert into cycle_tracking (updateCycleConfig)
    const upsertChain = makeUpsertChain({ error: null });
    const listChain = makeListChain({ data: history, error: null });
    const configChain = makeUpsertChain({ error: null });

    fromMock
      .mockReturnValueOnce(upsertChain)
      .mockReturnValueOnce(listChain)
      .mockReturnValueOnce(configChain);

    const result = await addPeriodStart(USER_ID, '2026-03-15');

    expect(result).toEqual(history);
    // Config should be updated with the most recent period start
    expect(configChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ last_period_start: '2026-03-15' }),
      { onConflict: 'user_id' }
    );
  });

  it('sets last_period_start to null when history is empty after insert', async () => {
    const upsertChain = makeUpsertChain({ error: null });
    const listChain = makeListChain({ data: [], error: null });
    const configChain = makeUpsertChain({ error: null });

    fromMock
      .mockReturnValueOnce(upsertChain)
      .mockReturnValueOnce(listChain)
      .mockReturnValueOnce(configChain);

    await addPeriodStart(USER_ID, '2026-03-15');

    expect(configChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ last_period_start: null }),
      { onConflict: 'user_id' }
    );
  });

  it('throws when the period_starts upsert fails', async () => {
    const upsertChain = makeUpsertChain({ error: new Error('upsert failed') });
    fromMock.mockReturnValueOnce(upsertChain);

    await expect(addPeriodStart(USER_ID, '2026-03-15')).rejects.toThrow('upsert failed');
  });
});

// ── deletePeriodStart ──────────────────────────────────────────────────────────

describe('deletePeriodStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes entry, refreshes history, and updates last_period_start in config', async () => {
    const history = [{ id: 'e1', start_date: '2026-02-01' }];

    // 1. delete from period_starts
    const deleteChain = makeSingleChain({ error: null });
    // 2. select from period_starts (getPeriodStartHistory)
    const listChain = makeListChain({ data: history, error: null });
    // 3. upsert into cycle_tracking
    const configChain = makeUpsertChain({ error: null });

    fromMock
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(listChain)
      .mockReturnValueOnce(configChain);

    const result = await deletePeriodStart(USER_ID, 'e2');

    expect(result).toEqual(history);
    expect(configChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ last_period_start: '2026-02-01' }),
      { onConflict: 'user_id' }
    );
  });

  it('throws when delete query fails', async () => {
    // .from().delete().eq('id', ...).eq('user_id', ...) — the second .eq() resolves
    const deleteChain = {
      delete: vi.fn(),
      eq: vi.fn(),
    };
    deleteChain.delete.mockReturnValue(deleteChain);
    let eqCount = 0;
    deleteChain.eq.mockImplementation(() => {
      eqCount++;
      if (eqCount >= 2) {
        return Promise.resolve({ error: new Error('delete failed') });
      }
      return deleteChain;
    });
    fromMock.mockReturnValueOnce(deleteChain);

    await expect(deletePeriodStart(USER_ID, 'e1')).rejects.toThrow('delete failed');
  });
});

// ── stampCyclePhaseOnSession ───────────────────────────────────────────────────

describe('stampCyclePhaseOnSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops when cycle tracking is disabled', async () => {
    // getCycleConfig returns disabled config
    fromMock.mockReturnValueOnce(
      makeSingleChain({ data: { is_enabled: false, cycle_length_days: 28, last_period_start: '2026-03-01' }, error: null })
    );

    await stampCyclePhaseOnSession(USER_ID, 'session-1');

    // No second DB call for session_logs update
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('no-ops when last_period_start is null', async () => {
    fromMock.mockReturnValueOnce(
      makeSingleChain({ data: { is_enabled: true, cycle_length_days: 28, last_period_start: null }, error: null })
    );

    await stampCyclePhaseOnSession(USER_ID, 'session-1');

    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('stamps cycle_phase on session_logs when enabled with a period start', async () => {
    // getCycleConfig
    fromMock.mockReturnValueOnce(
      makeSingleChain({
        data: { is_enabled: true, cycle_length_days: 28, last_period_start: '2026-03-01' },
        error: null,
      })
    );

    mockComputeCyclePhase.mockReturnValue({
      phase: 'luteal',
      dayOfCycle: 20,
      daysUntilNextPeriod: 8,
      isOvulatoryWindow: false,
      isLateLuteal: false,
    });

    // session_logs update chain
    const updateChain = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    updateChain.update.mockReturnValue(updateChain);
    updateChain.eq.mockReturnValue(updateChain);
    // Final .eq() resolves
    updateChain.eq.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: null });

    // Re-mock final resolution properly: chain returns self until the last eq
    const sessionLogsChain = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    sessionLogsChain.update.mockReturnValue(sessionLogsChain);
    // First eq returns chain, second eq (last call) resolves
    let eqCallCount = 0;
    sessionLogsChain.eq.mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount >= 2) {
        return Promise.resolve({ error: null });
      }
      return sessionLogsChain;
    });

    fromMock.mockReturnValueOnce(sessionLogsChain);

    await stampCyclePhaseOnSession(USER_ID, 'session-1');

    expect(sessionLogsChain.update).toHaveBeenCalledWith({ cycle_phase: 'luteal' });
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it('throws when session_logs update fails', async () => {
    fromMock.mockReturnValueOnce(
      makeSingleChain({
        data: { is_enabled: true, cycle_length_days: 28, last_period_start: '2026-03-01' },
        error: null,
      })
    );
    mockComputeCyclePhase.mockReturnValue({
      phase: 'follicular',
      dayOfCycle: 7,
      daysUntilNextPeriod: 21,
      isOvulatoryWindow: false,
      isLateLuteal: false,
    });

    const sessionLogsChain = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    sessionLogsChain.update.mockReturnValue(sessionLogsChain);
    let eqCallCount = 0;
    sessionLogsChain.eq.mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount >= 2) {
        return Promise.resolve({ error: new Error('update failed') });
      }
      return sessionLogsChain;
    });

    fromMock.mockReturnValueOnce(sessionLogsChain);

    await expect(stampCyclePhaseOnSession(USER_ID, 'session-1')).rejects.toThrow('update failed');
  });
});

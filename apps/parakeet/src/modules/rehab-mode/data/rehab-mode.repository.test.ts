import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ActiveRehabCapExistsError,
  endRehabCap,
  getActiveCapForLift,
  getRehabCap,
  getRehabCapHistory,
  insertRehabCap,
  listActiveRehabCaps,
  updateRehabCap,
} from './rehab-mode.repository';

const fromMock = vi.hoisted(() => vi.fn());

vi.mock('@platform/supabase', () => ({
  typedSupabase: { from: fromMock },
}));

function createChain(result: { data: unknown; error: unknown; count?: number }) {
  const chain = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    // Make the chain itself thenable so callers can await it after any chainable
    // method (e.g. `.order(...)` for list reads, `.range(...)` for paginated).
    then: (onFulfilled: (v: typeof result) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
  };
  for (const key of [
    'select',
    'insert',
    'update',
    'eq',
    'is',
    'order',
    'range',
  ] as const) {
    chain[key].mockReturnValue(chain);
  }
  chain.maybeSingle.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listActiveRehabCaps', () => {
  it('filters by user_id and null ended_at', async () => {
    const rows = [{ id: 'r1', user_id: 'u1', lift: 'squat' }];
    const chain = createChain({ data: rows, error: null });
    fromMock.mockReturnValueOnce(chain);

    const result = await listActiveRehabCaps('u1');

    expect(fromMock).toHaveBeenCalledWith('rehab_caps');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(chain.is).toHaveBeenCalledWith('ended_at', null);
    expect(result).toEqual(rows);
  });
});

describe('getActiveCapForLift', () => {
  it('returns null when no active cap exists', async () => {
    const chain = createChain({ data: null, error: null });
    fromMock.mockReturnValueOnce(chain);

    const result = await getActiveCapForLift('u1', 'squat');

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(chain.eq).toHaveBeenCalledWith('lift', 'squat');
    expect(chain.is).toHaveBeenCalledWith('ended_at', null);
    expect(result).toBeNull();
  });

  it('returns the row when an active cap exists', async () => {
    const row = { id: 'r1', user_id: 'u1', lift: 'squat', cap_kg: 80 };
    const chain = createChain({ data: row, error: null });
    fromMock.mockReturnValueOnce(chain);

    const result = await getActiveCapForLift('u1', 'squat');

    expect(result).toEqual(row);
  });
});

describe('insertRehabCap', () => {
  it('builds insert payload from user + input', async () => {
    const inserted = {
      id: 'r1',
      user_id: 'u1',
      lift: 'squat',
      cap_kg: 80,
      note: null,
      planned_end_date: null,
    };
    const chain = createChain({ data: inserted, error: null });
    fromMock.mockReturnValueOnce(chain);

    const result = await insertRehabCap('u1', { lift: 'squat', cap_kg: 80 });

    expect(chain.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      lift: 'squat',
      cap_kg: 80,
      note: null,
      planned_end_date: null,
    });
    expect(result).toEqual(inserted);
  });

  it('translates 23505 unique violation into ActiveRehabCapExistsError', async () => {
    const chain = createChain({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    });
    fromMock.mockReturnValueOnce(chain);

    await expect(
      insertRehabCap('u1', { lift: 'squat', cap_kg: 80 })
    ).rejects.toBeInstanceOf(ActiveRehabCapExistsError);
  });

  it('re-throws non-unique errors as-is', async () => {
    const pgError = { code: '42501', message: 'permission denied' };
    const chain = createChain({ data: null, error: pgError });
    fromMock.mockReturnValueOnce(chain);

    await expect(
      insertRehabCap('u1', { lift: 'squat', cap_kg: 80 })
    ).rejects.toBe(pgError);
  });
});

describe('updateRehabCap', () => {
  it('only sets provided fields', async () => {
    const updated = { id: 'r1', cap_kg: 85, note: null };
    const chain = createChain({ data: updated, error: null });
    fromMock.mockReturnValueOnce(chain);

    await updateRehabCap('r1', 'u1', { cap_kg: 85 });

    expect(chain.update).toHaveBeenCalledWith({ cap_kg: 85 });
    expect(chain.eq).toHaveBeenCalledWith('id', 'r1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('passes null through to clear nullable fields', async () => {
    const chain = createChain({ data: {}, error: null });
    fromMock.mockReturnValueOnce(chain);

    await updateRehabCap('r1', 'u1', {
      note: null,
      planned_end_date: null,
    });

    expect(chain.update).toHaveBeenCalledWith({
      note: null,
      planned_end_date: null,
    });
  });
});

describe('getRehabCap', () => {
  it('scopes the read to id + user_id', async () => {
    const row = { id: 'r1', user_id: 'u1' };
    const chain = createChain({ data: row, error: null });
    fromMock.mockReturnValueOnce(chain);

    const result = await getRehabCap('r1', 'u1');

    expect(chain.eq).toHaveBeenCalledWith('id', 'r1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(chain.maybeSingle).toHaveBeenCalled();
    expect(result).toEqual(row);
  });

  it('returns null when no row matches', async () => {
    const chain = createChain({ data: null, error: null });
    fromMock.mockReturnValueOnce(chain);

    const result = await getRehabCap('missing', 'u1');

    expect(result).toBeNull();
  });
});

describe('getRehabCapHistory', () => {
  it('paginates with default page=0 pageSize=20 → range(0, 19)', async () => {
    const chain = createChain({ data: [], error: null, count: 0 });
    fromMock.mockReturnValueOnce(chain);

    const result = await getRehabCapHistory('u1');

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(chain.range).toHaveBeenCalledWith(0, 19);
    expect(chain.order).toHaveBeenCalledWith('started_at', { ascending: false });
    expect(result).toEqual({ items: [], total: 0 });
  });

  it('computes range correctly for page=2 pageSize=20 → range(40, 59)', async () => {
    const chain = createChain({ data: [], error: null, count: 100 });
    fromMock.mockReturnValueOnce(chain);

    const result = await getRehabCapHistory('u1', { page: 2, pageSize: 20 });

    expect(chain.range).toHaveBeenCalledWith(40, 59);
    expect(result.total).toBe(100);
  });

  it('uses custom pageSize: page=1 pageSize=10 → range(10, 19)', async () => {
    const chain = createChain({ data: [], error: null, count: 0 });
    fromMock.mockReturnValueOnce(chain);

    await getRehabCapHistory('u1', { page: 1, pageSize: 10 });

    expect(chain.range).toHaveBeenCalledWith(10, 19);
  });

  it('returns items + total from supabase response', async () => {
    const items = [{ id: 'r1' }, { id: 'r2' }];
    const chain = createChain({ data: items, error: null, count: 42 });
    fromMock.mockReturnValueOnce(chain);

    const result = await getRehabCapHistory('u1');

    expect(result).toEqual({ items, total: 42 });
  });
});

describe('endRehabCap', () => {
  it('sets ended_at to the supplied date in ISO format', async () => {
    const chain = createChain({ data: {}, error: null });
    fromMock.mockReturnValueOnce(chain);

    const at = new Date('2026-06-01T10:00:00.000Z');
    await endRehabCap('r1', 'u1', at);

    expect(chain.update).toHaveBeenCalledWith({
      ended_at: '2026-06-01T10:00:00.000Z',
    });
  });
});

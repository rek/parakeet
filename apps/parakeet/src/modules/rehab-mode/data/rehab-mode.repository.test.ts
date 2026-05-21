import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ActiveRehabCapExistsError,
  endRehabCap,
  getActiveCapForLift,
  insertRehabCap,
  listActiveRehabCaps,
  updateRehabCap,
} from './rehab-mode.repository';

const fromMock = vi.hoisted(() => vi.fn());

vi.mock('@platform/supabase', () => ({
  typedSupabase: { from: fromMock },
}));

type ChainShape = ReturnType<typeof createChain>;

function createChain(result: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };
  // All chainable methods return the chain itself
  for (const key of ['select', 'insert', 'update', 'eq', 'is', 'order', 'range']) {
    chain[key].mockReturnValue(chain);
  }
  // Terminal methods resolve to the configured result
  chain.maybeSingle.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  // .range is also terminal for paginated reads
  chain.range.mockResolvedValue(result);
  // .order is terminal for non-paginated multi-row reads
  chain.order.mockResolvedValue(result);
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

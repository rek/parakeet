// session.repository.test.ts
import { describe, expect, it, vi } from 'vitest';
import { fetchTodaySession } from './session.repository';

const fromMock = vi.hoisted(() => vi.fn());

vi.mock('../network/supabase-client', () => ({
  typedSupabase: {
    from: fromMock,
  },
}));

describe('fetchTodaySession', () => {
  it('queries nearest upcoming incomplete session and excludes completed status', async () => {
    const expected = { id: 'next-session' };
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      not: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
    };

    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.in.mockReturnValue(chain);
    chain.not.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    chain.maybeSingle.mockResolvedValue({ data: expected, error: null });

    fromMock.mockReturnValue(chain);

    const result = await fetchTodaySession('user-1');

    expect(result).toEqual(expected);
    expect(fromMock).toHaveBeenCalledWith('sessions');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.in).toHaveBeenCalledWith('status', ['planned', 'in_progress']);
    expect(chain.not).toHaveBeenCalledWith('planned_date', 'is', null);
    expect(chain.order).toHaveBeenCalledWith('planned_date', {
      ascending: true,
    });
    expect(chain.limit).toHaveBeenCalledWith(1);

    const plannedDateEqCalls = chain.eq.mock.calls.filter(
      ([field]) => field === 'planned_date'
    );
    expect(plannedDateEqCalls).toHaveLength(0);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { insertPartnerSessionVideo } from './partner-video.repository';

const fromMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
}));

vi.mock('@platform/supabase', () => ({
  typedSupabase: {
    auth: { getUser: getUserMock },
    from: fromMock,
  },
  toJson: (v: unknown) => v,
}));

describe('insertPartnerSessionVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: { id: 'recorder-1' } },
    });
  });

  function createInsertChain(row: Record<string, unknown> = { id: 'v1' }) {
    const chain = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    chain.insert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: row, error: null });
    return chain;
  }

  it('rounds float durationSec to integer for DB column', async () => {
    const chain = createInsertChain({ id: 'v1' });
    fromMock.mockReturnValueOnce(chain);

    await insertPartnerSessionVideo({
      targetUserId: 'lifter-1',
      sessionId: 's1',
      lift: 'squat',
      setNumber: 1,
      localUri: '/videos/partner.mp4',
      durationSec: 12.162,
    });

    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.duration_sec).toBe(12);
    expect(Number.isInteger(insertArg.duration_sec)).toBe(true);
  });

  it('keeps integer durationSec unchanged', async () => {
    const chain = createInsertChain({ id: 'v2' });
    fromMock.mockReturnValueOnce(chain);

    await insertPartnerSessionVideo({
      targetUserId: 'lifter-1',
      sessionId: 's1',
      lift: 'deadlift',
      setNumber: 3,
      localUri: '/videos/partner.mp4',
      durationSec: 6,
    });

    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.duration_sec).toBe(6);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { insertSessionVideo } from './video.repository';

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

describe('insertSessionVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
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
    const row = {
      id: 'v1',
      session_id: 's1',
      lift: 'squat',
      set_number: 1,
      sagittal_confidence: 0.8,
      local_uri: '/videos/test.mp4',
      remote_uri: null,
      duration_sec: 12,
      analysis: null,
      coaching_response: null,
      set_weight_grams: null,
      set_reps: null,
      set_rpe: null,
      recorded_by: null,
      created_at: '2026-01-01T00:00:00Z',
    };
    const chain = createInsertChain(row);
    fromMock.mockReturnValueOnce(chain);

    await insertSessionVideo({
      sessionId: 's1',
      lift: 'squat',
      setNumber: 1,
      localUri: '/videos/test.mp4',
      durationSec: 12.162,
    });

    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.duration_sec).toBe(12);
    expect(Number.isInteger(insertArg.duration_sec)).toBe(true);
  });

  it('keeps integer durationSec unchanged', async () => {
    const row = {
      id: 'v1',
      session_id: 's1',
      lift: 'bench',
      set_number: 2,
      sagittal_confidence: 0.8,
      local_uri: '/videos/test.mp4',
      remote_uri: null,
      duration_sec: 8,
      analysis: null,
      coaching_response: null,
      set_weight_grams: null,
      set_reps: null,
      set_rpe: null,
      recorded_by: null,
      created_at: '2026-01-01T00:00:00Z',
    };
    const chain = createInsertChain(row);
    fromMock.mockReturnValueOnce(chain);

    await insertSessionVideo({
      sessionId: 's1',
      lift: 'bench',
      setNumber: 2,
      localUri: '/videos/test.mp4',
      durationSec: 8,
    });

    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.duration_sec).toBe(8);
  });
});

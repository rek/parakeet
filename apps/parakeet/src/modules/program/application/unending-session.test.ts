import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertSessionRows,
  updateUnendingSessionCounter,
} from '../data/program.repository';
import { appendNextUnendingSession } from './unending-session';

vi.mock('../data/program.repository', () => ({
  insertSessionRows: vi.fn().mockResolvedValue(undefined),
  updateUnendingSessionCounter: vi.fn().mockResolvedValue(undefined),
}));

describe('appendNextUnendingSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a session row with the correct shape for the given counter', async () => {
    const program = {
      id: 'prog-1',
      training_days_per_week: 3,
      unending_session_counter: 0,
      training_days: null,
    };
    await appendNextUnendingSession(program, 'user-1', '2026-03-07');

    expect(insertSessionRows).toHaveBeenCalledOnce();
    const [rows] = vi.mocked(insertSessionRows).mock.calls[0];
    const row = rows[0];
    expect(row.user_id).toBe('user-1');
    expect(row.program_id).toBe('prog-1');
    expect(row.planned_date).toBe('2026-03-07');
    expect(row.status).toBe('planned');
    expect(row.planned_sets).toBeNull();
    expect(row.jit_generated_at).toBeNull();
    expect(typeof row.week_number).toBe('number');
    expect(typeof row.day_number).toBe('number');
    expect(typeof row.primary_lift).toBe('string');
    expect(typeof row.intensity_type).toBe('string');
    expect([1, 2, 3]).toContain(row.block_number);
    expect(typeof row.is_deload).toBe('boolean');
  });

  it('advances the session counter after insert', async () => {
    const program = {
      id: 'prog-1',
      training_days_per_week: 3,
      unending_session_counter: 5,
      training_days: null,
    };
    await appendNextUnendingSession(program, 'user-1', '2026-03-07');

    expect(updateUnendingSessionCounter).toHaveBeenCalledWith('prog-1', 6);
  });

});

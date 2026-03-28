import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProfile, updateProfile } from './profile.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn());
const mockGetProfileById = vi.hoisted(() => vi.fn());
const mockUpdateProfileById = vi.hoisted(() => vi.fn());

vi.mock('../data/profile.repository', () => ({
  getAuthenticatedUserId: mockGetAuthenticatedUserId,
  getProfileById: mockGetProfileById,
  updateProfileById: mockUpdateProfileById,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PROFILE_ROW = {
  id: 'user-1',
  display_name: 'Test Lifter',
  biological_sex: 'male' as const,
  date_of_birth: '1990-05-15',
  bodyweight_kg: 85,
  created_at: '2024-01-01T00:00:00Z',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns profile data for authenticated user', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue('user-1');
    mockGetProfileById.mockResolvedValue(PROFILE_ROW);

    const result = await getProfile();

    expect(result).toMatchObject({
      id: 'user-1',
      display_name: 'Test Lifter',
      biological_sex: 'male',
      date_of_birth: '1990-05-15',
      bodyweight_kg: 85,
      created_at: '2024-01-01T00:00:00Z',
    });
  });

  it('passes the authenticated user id to getProfileById', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue('user-42');
    mockGetProfileById.mockResolvedValue(PROFILE_ROW);

    await getProfile();

    expect(mockGetProfileById).toHaveBeenCalledWith('user-42');
  });

  it('returns null when not authenticated', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null);

    const result = await getProfile();

    expect(result).toBeNull();
    expect(mockGetProfileById).not.toHaveBeenCalled();
  });

  it('returns null when profile does not exist in DB', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue('user-1');
    mockGetProfileById.mockResolvedValue(null);

    const result = await getProfile();

    expect(result).toBeNull();
  });

  it('normalizes biological_sex to null for unexpected values', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue('user-1');
    mockGetProfileById.mockResolvedValue({
      ...PROFILE_ROW,
      biological_sex: 'unknown',
    });

    const result = await getProfile();

    expect(result?.biological_sex).toBeNull();
  });

  it('preserves biological_sex=female', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue('user-1');
    mockGetProfileById.mockResolvedValue({
      ...PROFILE_ROW,
      biological_sex: 'female',
    });

    const result = await getProfile();

    expect(result?.biological_sex).toBe('female');
  });

  it('normalizes biological_sex=null to null', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue('user-1');
    mockGetProfileById.mockResolvedValue({
      ...PROFILE_ROW,
      biological_sex: null,
    });

    const result = await getProfile();

    expect(result?.biological_sex).toBeNull();
  });

  it('propagates errors thrown by getProfileById', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue('user-1');
    mockGetProfileById.mockRejectedValue(new Error('DB error'));

    await expect(getProfile()).rejects.toThrow('DB error');
  });
});

describe('updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls updateProfileById with the authenticated user id and update payload', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue('user-1');
    mockUpdateProfileById.mockResolvedValue(undefined);

    const update = { display_name: 'New Name', bodyweight_kg: 90 };
    await updateProfile(update);

    expect(mockUpdateProfileById).toHaveBeenCalledWith('user-1', update);
  });

  it('throws when not authenticated', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null);

    await expect(
      updateProfile({ display_name: 'Test' })
    ).rejects.toThrow('Not authenticated');

    expect(mockUpdateProfileById).not.toHaveBeenCalled();
  });

  it('propagates errors thrown by updateProfileById', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue('user-1');
    mockUpdateProfileById.mockRejectedValue(new Error('Update failed'));

    await expect(
      updateProfile({ display_name: 'Test' })
    ).rejects.toThrow('Update failed');
  });

  it('accepts partial update with only bodyweight_kg', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue('user-1');
    mockUpdateProfileById.mockResolvedValue(undefined);

    await expect(
      updateProfile({ bodyweight_kg: 95 })
    ).resolves.toBeUndefined();

    expect(mockUpdateProfileById).toHaveBeenCalledWith('user-1', {
      bodyweight_kg: 95,
    });
  });

  it('accepts partial update with only biological_sex', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue('user-1');
    mockUpdateProfileById.mockResolvedValue(undefined);

    await expect(
      updateProfile({ biological_sex: 'female' })
    ).resolves.toBeUndefined();

    expect(mockUpdateProfileById).toHaveBeenCalledWith('user-1', {
      biological_sex: 'female',
    });
  });

  it('accepts partial update with date_of_birth', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue('user-1');
    mockUpdateProfileById.mockResolvedValue(undefined);

    await updateProfile({ date_of_birth: '1985-03-20' });

    expect(mockUpdateProfileById).toHaveBeenCalledWith('user-1', {
      date_of_birth: '1985-03-20',
    });
  });
});

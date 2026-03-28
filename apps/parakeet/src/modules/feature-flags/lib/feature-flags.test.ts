import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetItem, mockSetItem } = vi.hoisted(() => ({
  mockGetItem: vi.fn(),
  mockSetItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mockGetItem,
    setItem: mockSetItem,
  },
}));

// Import after mocks are registered
import { DEFAULT_FLAGS, FEATURE_REGISTRY } from '../model/features';
import type { FeatureId } from '../model/features';
import { getFeatureFlags, setFeatureFlag, setFeatureFlags } from './feature-flags';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getFeatureFlags ────────────────────────────────────────────────────────────

describe('getFeatureFlags', () => {
  it('returns a copy of DEFAULT_FLAGS when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null);
    const flags = await getFeatureFlags();
    expect(flags).toEqual(DEFAULT_FLAGS);
  });

  it('all default flags are enabled', async () => {
    mockGetItem.mockResolvedValue(null);
    const flags = await getFeatureFlags();
    for (const feature of FEATURE_REGISTRY) {
      expect(flags[feature.id]).toBe(feature.defaultEnabled);
    }
  });

  it('returns defaults when storage is empty string', async () => {
    mockGetItem.mockResolvedValue('');
    const flags = await getFeatureFlags();
    expect(flags).toEqual(DEFAULT_FLAGS);
  });

  it('merges stored overrides over defaults', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ warmups: false }));
    const flags = await getFeatureFlags();
    expect(flags.warmups).toBe(false);
    // All other flags remain at their defaults
    expect(flags.auxiliary).toBe(DEFAULT_FLAGS.auxiliary);
    expect(flags.restTimer).toBe(DEFAULT_FLAGS.restTimer);
  });

  it('stored override of true takes effect', async () => {
    // All defaults are currently true; ensure we can round-trip explicit true
    mockGetItem.mockResolvedValue(JSON.stringify({ aiJit: true }));
    const flags = await getFeatureFlags();
    expect(flags.aiJit).toBe(true);
  });

  it('missing flags in stored object fall back to defaults', async () => {
    // Partial override — most flags absent from stored JSON
    mockGetItem.mockResolvedValue(JSON.stringify({ developer: false }));
    const flags = await getFeatureFlags();
    // Every flag that was not overridden matches the default
    for (const feature of FEATURE_REGISTRY) {
      if (feature.id !== 'developer') {
        expect(flags[feature.id]).toBe(DEFAULT_FLAGS[feature.id]);
      }
    }
    expect(flags.developer).toBe(false);
  });

  it('returns defaults when stored JSON is malformed', async () => {
    mockGetItem.mockResolvedValue('{not valid json}');
    const flags = await getFeatureFlags();
    expect(flags).toEqual(DEFAULT_FLAGS);
  });

  it('returns defaults when AsyncStorage throws', async () => {
    mockGetItem.mockRejectedValue(new Error('storage unavailable'));
    const flags = await getFeatureFlags();
    expect(flags).toEqual(DEFAULT_FLAGS);
  });

  it('reads from the "feature_flags" storage key', async () => {
    mockGetItem.mockResolvedValue(null);
    await getFeatureFlags();
    expect(mockGetItem).toHaveBeenCalledWith('feature_flags');
  });

  it('returns a fresh object each call (not shared reference)', async () => {
    mockGetItem.mockResolvedValue(null);
    const a = await getFeatureFlags();
    const b = await getFeatureFlags();
    expect(a).not.toBe(b);
  });
});

// ── setFeatureFlags ────────────────────────────────────────────────────────────

describe('setFeatureFlags', () => {
  it('writes JSON-encoded flags to the "feature_flags" key', async () => {
    mockSetItem.mockResolvedValue(undefined);
    const flags = { ...DEFAULT_FLAGS };
    await setFeatureFlags(flags);
    expect(mockSetItem).toHaveBeenCalledWith(
      'feature_flags',
      JSON.stringify(flags)
    );
  });
});

// ── setFeatureFlag ─────────────────────────────────────────────────────────────

describe('setFeatureFlag', () => {
  it('disables a single flag while preserving all others', async () => {
    mockGetItem.mockResolvedValue(null); // getFeatureFlags returns defaults
    mockSetItem.mockResolvedValue(undefined);

    await setFeatureFlag({ id: 'warmups', enabled: false });

    const written = JSON.parse(mockSetItem.mock.calls[0][1] as string) as Record<
      FeatureId,
      boolean
    >;
    expect(written.warmups).toBe(false);
    // All other flags should match their defaults
    for (const feature of FEATURE_REGISTRY) {
      if (feature.id !== 'warmups') {
        expect(written[feature.id]).toBe(DEFAULT_FLAGS[feature.id]);
      }
    }
  });

  it('enables a flag that was previously disabled', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ ...DEFAULT_FLAGS, aiJit: false }));
    mockSetItem.mockResolvedValue(undefined);

    await setFeatureFlag({ id: 'aiJit', enabled: true });

    const written = JSON.parse(mockSetItem.mock.calls[0][1] as string) as Record<
      FeatureId,
      boolean
    >;
    expect(written.aiJit).toBe(true);
  });

  it('writes to storage exactly once per call', async () => {
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);

    await setFeatureFlag({ id: 'developer', enabled: false });

    expect(mockSetItem).toHaveBeenCalledTimes(1);
  });

  it('preserves previously-stored overrides for unrelated flags', async () => {
    // Existing state: warmups disabled
    mockGetItem.mockResolvedValue(JSON.stringify({ ...DEFAULT_FLAGS, warmups: false }));
    mockSetItem.mockResolvedValue(undefined);

    // Toggle a different flag
    await setFeatureFlag({ id: 'streaks', enabled: false });

    const written = JSON.parse(mockSetItem.mock.calls[0][1] as string) as Record<
      FeatureId,
      boolean
    >;
    expect(written.warmups).toBe(false); // original override preserved
    expect(written.streaks).toBe(false); // new override applied
  });

  it('stores the updated flags under the "feature_flags" key', async () => {
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);

    await setFeatureFlag({ id: 'wilks', enabled: false });

    expect(mockSetItem.mock.calls[0][0]).toBe('feature_flags');
  });
});

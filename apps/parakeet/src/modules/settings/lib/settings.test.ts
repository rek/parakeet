import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import after mocks are registered
import {
  getBarWeightKg,
  getDisabledPlates,
  getJITStrategyOverride,
  getRestTimerPrefs,
  getWarmupPlateDisplay,
  setBarWeightKg,
  setDisabledPlates,
  setJITStrategyOverride,
  setRestTimerPrefs,
  setWarmupPlateDisplay,
} from './settings';

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

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getBarWeightKg ─────────────────────────────────────────────────────────────

describe('getBarWeightKg', () => {
  it('returns 20 as default when nothing stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getBarWeightKg()).toBe(20);
  });

  it('returns 15 when "15" is stored', async () => {
    mockGetItem.mockResolvedValue('15');
    expect(await getBarWeightKg()).toBe(15);
  });

  it('returns 20 when "20" is stored', async () => {
    mockGetItem.mockResolvedValue('20');
    expect(await getBarWeightKg()).toBe(20);
  });

  it('returns default 20 for unrecognised stored value', async () => {
    mockGetItem.mockResolvedValue('25');
    expect(await getBarWeightKg()).toBe(20);
  });

  it('returns default 20 when AsyncStorage throws', async () => {
    mockGetItem.mockRejectedValue(new Error('storage error'));
    expect(await getBarWeightKg()).toBe(20);
  });

  it('ignores the _biologicalSex argument (no effect on result)', async () => {
    mockGetItem.mockResolvedValue('15');
    expect(await getBarWeightKg('female')).toBe(15);
  });
});

// ── setBarWeightKg ─────────────────────────────────────────────────────────────

describe('setBarWeightKg', () => {
  it('writes the value as a string to AsyncStorage', async () => {
    mockSetItem.mockResolvedValue(undefined);
    await setBarWeightKg(15);
    expect(mockSetItem).toHaveBeenCalledWith('bar_weight_kg', '15');
  });
});

// ── getJITStrategyOverride ─────────────────────────────────────────────────────

describe('getJITStrategyOverride', () => {
  it('returns "auto" when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getJITStrategyOverride()).toBe('auto');
  });

  it('returns "formula" when stored', async () => {
    mockGetItem.mockResolvedValue('formula');
    expect(await getJITStrategyOverride()).toBe('formula');
  });

  it('returns "llm" when stored', async () => {
    mockGetItem.mockResolvedValue('llm');
    expect(await getJITStrategyOverride()).toBe('llm');
  });

  it('returns "hybrid" when stored', async () => {
    mockGetItem.mockResolvedValue('hybrid');
    expect(await getJITStrategyOverride()).toBe('hybrid');
  });

  it('returns "auto" for unrecognised stored value', async () => {
    mockGetItem.mockResolvedValue('turbo');
    expect(await getJITStrategyOverride()).toBe('auto');
  });

  it('returns "auto" when AsyncStorage throws', async () => {
    mockGetItem.mockRejectedValue(new Error('storage error'));
    expect(await getJITStrategyOverride()).toBe('auto');
  });
});

// ── setJITStrategyOverride ─────────────────────────────────────────────────────

describe('setJITStrategyOverride', () => {
  it('writes the strategy string to AsyncStorage', async () => {
    mockSetItem.mockResolvedValue(undefined);
    await setJITStrategyOverride('hybrid');
    expect(mockSetItem).toHaveBeenCalledWith('jit_strategy_override', 'hybrid');
  });
});

// ── getDisabledPlates ──────────────────────────────────────────────────────────

describe('getDisabledPlates', () => {
  it('returns empty array when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getDisabledPlates()).toEqual([]);
  });

  it('parses and returns stored plate array', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([25, 1.25]));
    expect(await getDisabledPlates()).toEqual([25, 1.25]);
  });

  it('returns empty array when stored value is empty string', async () => {
    mockGetItem.mockResolvedValue('');
    expect(await getDisabledPlates()).toEqual([]);
  });

  it('returns empty array when JSON is malformed', async () => {
    mockGetItem.mockResolvedValue('{not-valid-json}');
    expect(await getDisabledPlates()).toEqual([]);
  });

  it('returns empty array when AsyncStorage throws', async () => {
    mockGetItem.mockRejectedValue(new Error('storage error'));
    expect(await getDisabledPlates()).toEqual([]);
  });
});

// ── setDisabledPlates ──────────────────────────────────────────────────────────

describe('setDisabledPlates', () => {
  it('writes JSON-encoded array to AsyncStorage', async () => {
    mockSetItem.mockResolvedValue(undefined);
    await setDisabledPlates([20, 5]);
    expect(mockSetItem).toHaveBeenCalledWith(
      'disabled_plates_kg',
      JSON.stringify([20, 5])
    );
  });
});

// ── getWarmupPlateDisplay ──────────────────────────────────────────────────────

describe('getWarmupPlateDisplay', () => {
  it('returns "numbers" as default when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getWarmupPlateDisplay()).toBe('numbers');
  });

  it('returns "numbers" when stored', async () => {
    mockGetItem.mockResolvedValue('numbers');
    expect(await getWarmupPlateDisplay()).toBe('numbers');
  });

  it('returns "colors" when stored', async () => {
    mockGetItem.mockResolvedValue('colors');
    expect(await getWarmupPlateDisplay()).toBe('colors');
  });

  it('returns "numbers" for unrecognised stored value', async () => {
    mockGetItem.mockResolvedValue('icons');
    expect(await getWarmupPlateDisplay()).toBe('numbers');
  });

  it('returns "numbers" when AsyncStorage throws', async () => {
    mockGetItem.mockRejectedValue(new Error('storage error'));
    expect(await getWarmupPlateDisplay()).toBe('numbers');
  });
});

// ── setWarmupPlateDisplay ──────────────────────────────────────────────────────

describe('setWarmupPlateDisplay', () => {
  it('writes the mode string to AsyncStorage', async () => {
    mockSetItem.mockResolvedValue(undefined);
    await setWarmupPlateDisplay('colors');
    expect(mockSetItem).toHaveBeenCalledWith('warmup_plate_display', 'colors');
  });
});

// ── getRestTimerPrefs ──────────────────────────────────────────────────────────

describe('getRestTimerPrefs', () => {
  const DEFAULTS = {
    audioAlert: true,
    hapticAlert: true,
    llmSuggestions: true,
    backgroundRestNotification: true,
    mainSetsEnabled: true,
    auxSetsEnabled: true,
    postWarmupEnabled: true,
    postWarmupSeconds: 120,
  };

  it('returns all defaults when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getRestTimerPrefs()).toEqual(DEFAULTS);
  });

  it('merges stored partial prefs over defaults', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ audioAlert: false, postWarmupSeconds: 90 })
    );
    const result = await getRestTimerPrefs();
    expect(result.audioAlert).toBe(false);
    expect(result.postWarmupSeconds).toBe(90);
    // non-overridden defaults are preserved
    expect(result.hapticAlert).toBe(true);
    expect(result.mainSetsEnabled).toBe(true);
  });

  it('returns defaults when stored JSON is malformed', async () => {
    mockGetItem.mockResolvedValue('{bad json');
    expect(await getRestTimerPrefs()).toEqual(DEFAULTS);
  });

  it('returns defaults when AsyncStorage throws', async () => {
    mockGetItem.mockRejectedValue(new Error('storage error'));
    expect(await getRestTimerPrefs()).toEqual(DEFAULTS);
  });

  it('returns a fresh copy of defaults (not the same object reference)', async () => {
    mockGetItem.mockResolvedValue(null);
    const a = await getRestTimerPrefs();
    const b = await getRestTimerPrefs();
    expect(a).not.toBe(b);
  });
});

// ── setRestTimerPrefs ──────────────────────────────────────────────────────────

describe('setRestTimerPrefs', () => {
  it('merges partial prefs with current state and writes to storage', async () => {
    // First getItem returns defaults, second call in setRestTimerPrefs also needs null
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);

    await setRestTimerPrefs({ audioAlert: false });

    const written = JSON.parse(mockSetItem.mock.calls[0][1] as string);
    expect(written.audioAlert).toBe(false);
    // All other defaults preserved
    expect(written.hapticAlert).toBe(true);
    expect(written.postWarmupSeconds).toBe(120);
  });

  it('overwrites only the specified fields', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ audioAlert: false, postWarmupSeconds: 60 })
    );
    mockSetItem.mockResolvedValue(undefined);

    await setRestTimerPrefs({ postWarmupSeconds: 90 });

    const written = JSON.parse(mockSetItem.mock.calls[0][1] as string);
    // audioAlert preserved from existing stored value
    expect(written.audioAlert).toBe(false);
    expect(written.postWarmupSeconds).toBe(90);
  });
});

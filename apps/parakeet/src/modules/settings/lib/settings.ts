import type { PlateKg } from '@shared/constants/plates';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BAR_WEIGHT_KEY = 'bar_weight_kg';

export type BarWeightKg = 15 | 20;

export async function getBarWeightKg(
  _biologicalSex?: string | null
): Promise<BarWeightKg> {
  const defaultWeight: BarWeightKg = 20;
  try {
    const raw = await AsyncStorage.getItem(BAR_WEIGHT_KEY);
    if (raw === '15') return 15;
    if (raw === '20') return 20;
    return defaultWeight;
  } catch {
    return defaultWeight;
  }
}

export async function setBarWeightKg(kg: BarWeightKg): Promise<void> {
  await AsyncStorage.setItem(BAR_WEIGHT_KEY, String(kg));
}

const JIT_STRATEGY_KEY = 'jit_strategy_override';

export type JITStrategyOverride = 'auto' | 'formula' | 'llm' | 'hybrid';

export async function getJITStrategyOverride(): Promise<JITStrategyOverride> {
  try {
    const raw = await AsyncStorage.getItem(JIT_STRATEGY_KEY);
    if (raw === 'formula' || raw === 'llm' || raw === 'hybrid') return raw;
    return 'auto';
  } catch {
    return 'auto';
  }
}

export async function setJITStrategyOverride(
  strategy: JITStrategyOverride
): Promise<void> {
  await AsyncStorage.setItem(JIT_STRATEGY_KEY, strategy);
}

const DISABLED_PLATES_KEY = 'disabled_plates_kg';

/** Returns plates that are disabled (not available in the user's gym). Default: none disabled. */
export async function getDisabledPlates(): Promise<PlateKg[]> {
  try {
    const raw = await AsyncStorage.getItem(DISABLED_PLATES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PlateKg[];
  } catch {
    return [];
  }
}

export async function setDisabledPlates(disabled: PlateKg[]): Promise<void> {
  await AsyncStorage.setItem(DISABLED_PLATES_KEY, JSON.stringify(disabled));
}

const WARMUP_PLATE_DISPLAY_KEY = 'warmup_plate_display';

export type WarmupPlateDisplay = 'numbers' | 'colors';

export async function getWarmupPlateDisplay(): Promise<WarmupPlateDisplay> {
  try {
    const raw = await AsyncStorage.getItem(WARMUP_PLATE_DISPLAY_KEY);
    if (raw === 'numbers' || raw === 'colors') return raw;
    return 'numbers';
  } catch {
    return 'numbers';
  }
}

export async function setWarmupPlateDisplay(
  mode: WarmupPlateDisplay
): Promise<void> {
  await AsyncStorage.setItem(WARMUP_PLATE_DISPLAY_KEY, mode);
}

const REST_TIMER_PREFS_KEY = 'rest_timer_prefs';

export interface RestTimerPrefs {
  audioAlert: boolean;
  hapticAlert: boolean;
  llmSuggestions: boolean;
  backgroundRestNotification: boolean;
  mainSetsEnabled: boolean;
  auxSetsEnabled: boolean;
  postWarmupEnabled: boolean;
  postWarmupSeconds: number;
}

const DEFAULT_REST_TIMER_PREFS: RestTimerPrefs = {
  audioAlert: true,
  hapticAlert: true,
  llmSuggestions: true,
  backgroundRestNotification: true,
  mainSetsEnabled: true,
  auxSetsEnabled: true,
  postWarmupEnabled: true,
  postWarmupSeconds: 120,
};

export async function getRestTimerPrefs(): Promise<RestTimerPrefs> {
  try {
    const raw = await AsyncStorage.getItem(REST_TIMER_PREFS_KEY);
    if (!raw) return { ...DEFAULT_REST_TIMER_PREFS };
    const parsed = JSON.parse(raw) as Partial<RestTimerPrefs>;
    return { ...DEFAULT_REST_TIMER_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_REST_TIMER_PREFS };
  }
}

export async function setRestTimerPrefs(
  prefs: Partial<RestTimerPrefs>
): Promise<void> {
  const current = await getRestTimerPrefs();
  const next = { ...current, ...prefs };
  await AsyncStorage.setItem(REST_TIMER_PREFS_KEY, JSON.stringify(next));
}

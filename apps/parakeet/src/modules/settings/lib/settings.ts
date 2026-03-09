import AsyncStorage from '@react-native-async-storage/async-storage'
import type { PlateKg } from '@parakeet/training-engine'

const BAR_WEIGHT_KEY = 'bar_weight_kg'

export type BarWeightKg = 15 | 20

export async function getBarWeightKg(biologicalSex?: string | null): Promise<BarWeightKg> {
  const defaultWeight: BarWeightKg = 20
  try {
    const raw = await AsyncStorage.getItem(BAR_WEIGHT_KEY)
    if (raw === '15') return 15
    if (raw === '20') return 20
    return defaultWeight
  } catch {
    return defaultWeight
  }
}

export async function setBarWeightKg(kg: BarWeightKg): Promise<void> {
  await AsyncStorage.setItem(BAR_WEIGHT_KEY, String(kg))
}

const JIT_STRATEGY_KEY = 'jit_strategy_override'

export type JITStrategyOverride = 'auto' | 'formula' | 'llm' | 'hybrid'

export async function getJITStrategyOverride(): Promise<JITStrategyOverride> {
  try {
    const raw = await AsyncStorage.getItem(JIT_STRATEGY_KEY)
    if (raw === 'formula' || raw === 'llm' || raw === 'hybrid') return raw
    return 'auto'
  } catch {
    return 'auto'
  }
}

export async function setJITStrategyOverride(strategy: JITStrategyOverride): Promise<void> {
  await AsyncStorage.setItem(JIT_STRATEGY_KEY, strategy)
}

const DISABLED_PLATES_KEY = 'disabled_plates_kg'

/** Returns plates that are disabled (not available in the user's gym). Default: none disabled. */
export async function getDisabledPlates(): Promise<PlateKg[]> {
  try {
    const raw = await AsyncStorage.getItem(DISABLED_PLATES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PlateKg[]
  } catch {
    return []
  }
}

export async function setDisabledPlates(disabled: PlateKg[]): Promise<void> {
  await AsyncStorage.setItem(DISABLED_PLATES_KEY, JSON.stringify(disabled))
}

const REST_TIMER_PREFS_KEY = 'rest_timer_prefs'

export interface RestTimerPrefs {
  audioAlert: boolean
  hapticAlert: boolean
  llmSuggestions: boolean
  backgroundRestNotification: boolean
}

const DEFAULT_REST_TIMER_PREFS: RestTimerPrefs = {
  audioAlert: true,
  hapticAlert: true,
  llmSuggestions: true,
  backgroundRestNotification: true,
}

export async function getRestTimerPrefs(): Promise<RestTimerPrefs> {
  try {
    const raw = await AsyncStorage.getItem(REST_TIMER_PREFS_KEY)
    if (!raw) return { ...DEFAULT_REST_TIMER_PREFS }
    const parsed = JSON.parse(raw) as Partial<RestTimerPrefs>
    return { ...DEFAULT_REST_TIMER_PREFS, ...parsed }
  } catch {
    return { ...DEFAULT_REST_TIMER_PREFS }
  }
}

export async function setRestTimerPrefs(prefs: Partial<RestTimerPrefs>): Promise<void> {
  const current = await getRestTimerPrefs()
  const next = { ...current, ...prefs }
  await AsyncStorage.setItem(REST_TIMER_PREFS_KEY, JSON.stringify(next))
}

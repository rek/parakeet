import AsyncStorage from '@react-native-async-storage/async-storage'

const BAR_WEIGHT_KEY = 'bar_weight_kg'

export type BarWeightKg = 15 | 20

export async function getBarWeightKg(): Promise<BarWeightKg> {
  try {
    const raw = await AsyncStorage.getItem(BAR_WEIGHT_KEY)
    if (raw === '15') return 15
    return 20
  } catch {
    return 20
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
  backgroundRestNotification: false,
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

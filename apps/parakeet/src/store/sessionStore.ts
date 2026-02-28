import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface ActualSet {
  set_number: number
  weight_grams: number
  reps_completed: number
  rpe_actual?: number
  is_completed: boolean
  actual_rest_seconds?: number
}

export interface AuxiliaryActualSet {
  exercise: string
  set_number: number
  weight_grams: number
  reps_completed: number
  rpe_actual?: number
  is_completed: boolean
  actual_rest_seconds?: number
}

interface TimerState {
  visible: boolean
  durationSeconds: number
  elapsed: number                      // total seconds elapsed
  offset: number                       // user ±30s adjustments
  timerStartedAt: number | null        // Date.now() when timer last started/resumed
  pendingMainSetNumber: number | null
  pendingAuxExercise: string | null
  pendingAuxSetNumber: number | null
}

interface SessionState {
  sessionId: string | null
  plannedSets: { weight_kg: number; reps: number }[]
  actualSets: ActualSet[]
  auxiliarySets: AuxiliaryActualSet[]
  warmupCompleted: Set<number>
  sessionRpe: number | undefined
  startedAt: Date | undefined
  sessionMeta: {
    primary_lift: string
    intensity_type: string
    block_number: number | null
    week_number: number
  } | null
  cachedJitData: string | null
  timerState: TimerState | null

  updateSet: (setNumber: number, data: Partial<ActualSet>) => void
  updateAuxiliarySet: (exercise: string, setNumber: number, data: Partial<AuxiliaryActualSet>) => void
  setWarmupDone: (index: number, done: boolean) => void
  setSessionRpe: (rpe: number) => void
  initSession: (sessionId: string, plannedSets: { weight_kg: number; reps: number }[]) => void
  initAuxiliary: (work: { exercise: string; sets: { weight_kg: number; reps: number }[] }[]) => void
  setSessionMeta: (meta: SessionState['sessionMeta']) => void
  setCachedJitData: (raw: string) => void
  openTimer: (opts: {
    durationSeconds: number
    pendingMainSetNumber?: number
    pendingAuxExercise?: string
    pendingAuxSetNumber?: number
  }) => void
  tickTimer: () => void
  adjustTimer: (deltaSecs: number) => void
  closeTimer: () => number
  reset: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      plannedSets: [],
      actualSets: [],
      auxiliarySets: [],
      warmupCompleted: new Set(),
      sessionRpe: undefined,
      startedAt: undefined,
      sessionMeta: null,
      cachedJitData: null,
      timerState: null,

      initSession: (sessionId, plannedSets) => set({
        sessionId,
        startedAt: new Date(),
        plannedSets,
        actualSets: plannedSets.map((s, i) => ({
          set_number: i + 1,
          weight_grams: Math.round(s.weight_kg * 1000),
          reps_completed: s.reps,
          is_completed: false,
        })),
        warmupCompleted: new Set(),
        sessionRpe: undefined,
      }),

      initAuxiliary: (work) => set({
        auxiliarySets: work.flatMap(({ exercise, sets }) =>
          sets.map((s, i) => ({
            exercise,
            set_number: i + 1,
            weight_grams: Math.round(s.weight_kg * 1000),
            reps_completed: s.reps,
            is_completed: false,
          }))
        ),
      }),

      updateSet: (setNumber, data) => set((state) => ({
        actualSets: state.actualSets.map((s) =>
          s.set_number === setNumber ? { ...s, ...data } : s
        ),
      })),

      updateAuxiliarySet: (exercise, setNumber, data) => set((state) => ({
        auxiliarySets: state.auxiliarySets.map((s) =>
          s.exercise === exercise && s.set_number === setNumber ? { ...s, ...data } : s
        ),
      })),

      setWarmupDone: (index, done) => set((state) => {
        const next = new Set(state.warmupCompleted)
        if (done) next.add(index)
        else next.delete(index)
        return { warmupCompleted: next }
      }),

      setSessionRpe: (rpe) => set({ sessionRpe: rpe }),

      setSessionMeta: (meta) => set({ sessionMeta: meta }),

      setCachedJitData: (raw) => set({ cachedJitData: raw }),

      openTimer: ({ durationSeconds, pendingMainSetNumber, pendingAuxExercise, pendingAuxSetNumber }) =>
        set({
          timerState: {
            visible: true,
            durationSeconds,
            elapsed: 0,
            offset: 0,
            timerStartedAt: Date.now(),
            pendingMainSetNumber: pendingMainSetNumber ?? null,
            pendingAuxExercise: pendingAuxExercise ?? null,
            pendingAuxSetNumber: pendingAuxSetNumber ?? null,
          },
        }),

      tickTimer: () => set((state) => {
        const t = state.timerState
        if (!t || !t.timerStartedAt) return {}
        return {
          timerState: {
            ...t,
            elapsed: Math.floor((Date.now() - t.timerStartedAt) / 1000),
          },
        }
      }),

      adjustTimer: (deltaSecs) => set((state) => {
        const t = state.timerState
        if (!t) return {}
        const nextOffset = Math.max(-t.durationSeconds, t.offset + deltaSecs)
        return { timerState: { ...t, offset: nextOffset } }
      }),

      closeTimer: () => {
        const elapsed = get().timerState?.elapsed ?? 0
        set({ timerState: null })
        return elapsed
      },

      reset: () => set({
        sessionId: null,
        plannedSets: [],
        actualSets: [],
        auxiliarySets: [],
        warmupCompleted: new Set(),
        sessionRpe: undefined,
        startedAt: undefined,
        sessionMeta: null,
        cachedJitData: null,
        timerState: null,
      }),
    }),
    {
      name: 'parakeet-session',
      storage: createJSONStorage(() => AsyncStorage),
      // Exclude warmupCompleted (Set not JSON-serializable) and startedAt (Date)
      partialize: (state) => ({
        sessionId:     state.sessionId,
        plannedSets:   state.plannedSets,
        actualSets:    state.actualSets,
        auxiliarySets: state.auxiliarySets,
        sessionRpe:    state.sessionRpe,
        sessionMeta:   state.sessionMeta,
        cachedJitData: state.cachedJitData,
        timerState:    state.timerState,
      }),
    }
  )
)

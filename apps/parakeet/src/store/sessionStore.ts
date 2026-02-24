import { create } from 'zustand'

export interface ActualSet {
  set_number: number
  weight_grams: number
  reps_completed: number
  rpe_actual?: number
  is_completed: boolean
}

interface SessionState {
  sessionId: string | null
  plannedSets: { weight_kg: number; reps: number }[]
  actualSets: ActualSet[]
  warmupCompleted: Set<number>
  sessionRpe: number | undefined
  startedAt: Date | undefined
  updateSet: (setNumber: number, data: Partial<ActualSet>) => void
  setWarmupDone: (index: number, done: boolean) => void
  setSessionRpe: (rpe: number) => void
  initSession: (sessionId: string, plannedSets: { weight_kg: number; reps: number }[]) => void
  reset: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  plannedSets: [],
  actualSets: [],
  warmupCompleted: new Set(),
  sessionRpe: undefined,
  startedAt: undefined,

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

  updateSet: (setNumber, data) => set((state) => ({
    actualSets: state.actualSets.map((s) =>
      s.set_number === setNumber ? { ...s, ...data } : s
    ),
  })),

  setWarmupDone: (index, done) => set((state) => {
    const next = new Set(state.warmupCompleted)
    if (done) next.add(index)
    else next.delete(index)
    return { warmupCompleted: next }
  }),

  setSessionRpe: (rpe) => set({ sessionRpe: rpe }),

  reset: () => set({
    sessionId: null,
    plannedSets: [],
    actualSets: [],
    warmupCompleted: new Set(),
    sessionRpe: undefined,
    startedAt: undefined,
  }),
}))

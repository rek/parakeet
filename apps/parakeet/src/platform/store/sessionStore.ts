import type { AdaptedPlan, VolumeRecoveryOffer } from '@parakeet/training-engine';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { weightKgToGrams } from '@shared/utils/weight';

export interface ActualSet {
  set_number: number;
  weight_grams: number;
  reps_completed: number;
  rpe_actual?: number;
  is_completed: boolean;
  actual_rest_seconds?: number;
  is_recovered?: boolean;
}

export interface AuxiliaryActualSet {
  exercise: string;
  set_number: number;
  weight_grams: number;
  reps_completed: number;
  rpe_actual?: number;
  is_completed: boolean;
  actual_rest_seconds?: number;
}

interface TimerState {
  visible: boolean;
  durationSeconds: number;
  elapsed: number;
  offset: number;
  timerStartedAt: number | null;
  pendingMainSetNumber: number | null;
  pendingAuxExercise: string | null;
  pendingAuxSetNumber: number | null;
}

export interface SessionState {
  sessionId: string | null;
  plannedSets: { weight_kg: number; reps: number }[];
  actualSets: ActualSet[];
  auxiliarySets: AuxiliaryActualSet[];
  warmupCompleted: number[];
  sessionRpe: number | undefined;
  startedAt: Date | undefined;
  sessionMeta: {
    primary_lift: string | null;
    intensity_type: string | null;
    block_number: number | null;
    week_number: number;
    activity_name?: string | null;
  } | null;
  cachedJitData: string | null;
  cachedPrescriptionTrace: string | null;
  timerState: TimerState | null;
  consecutiveMainLiftFailures: number;
  currentAdaptation: AdaptedPlan | null;
  recoveryOffer: VolumeRecoveryOffer | null;
  recoveryDismissed: boolean;

  updateSet: (setNumber: number, data: Partial<ActualSet>) => void;
  updateAuxiliarySet: (
    exercise: string,
    setNumber: number,
    data: Partial<AuxiliaryActualSet>
  ) => void;
  addAdHocSet: (exercise: string, initialWeightGrams?: number) => void;
  removeAdHocSet: (exercise: string, setNumber: number) => void;
  setWarmupDone: (index: number, done: boolean) => void;
  setSessionRpe: (rpe: number) => void;
  initSession: (
    sessionId: string,
    plannedSets: { weight_kg: number; reps: number }[]
  ) => void;
  initAuxiliary: (
    work: { exercise: string; sets: { weight_kg: number; reps: number }[] }[]
  ) => void;
  setSessionMeta: (meta: SessionState['sessionMeta']) => void;
  setCachedJitData: (raw: string) => void;
  setCachedPrescriptionTrace: (raw: string) => void;
  recordSetFailure: () => void;
  recordSetSuccess: () => void;
  setAdaptation: (plan: AdaptedPlan) => void;
  resetAdaptation: () => void;
  setRecoveryOffer: (offer: VolumeRecoveryOffer) => void;
  acceptRecovery: () => void;
  dismissRecovery: () => void;
  openTimer: (opts: {
    durationSeconds: number;
    pendingMainSetNumber?: number;
    pendingAuxExercise?: string;
    pendingAuxSetNumber?: number;
  }) => void;
  tickTimer: () => void;
  adjustTimer: (deltaSecs: number) => void;
  closeTimer: () => number;
  reset: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      plannedSets: [],
      actualSets: [],
      auxiliarySets: [],
      warmupCompleted: [],
      sessionRpe: undefined,
      startedAt: undefined,
      sessionMeta: null,
      cachedJitData: null,
      cachedPrescriptionTrace: null,
      timerState: null,
      consecutiveMainLiftFailures: 0,
      currentAdaptation: null,
      recoveryOffer: null,
      recoveryDismissed: false,

      initSession: (sessionId, plannedSets) =>
        set({
          sessionId,
          startedAt: new Date(),
          plannedSets,
          actualSets: plannedSets.map((s, i) => ({
            set_number: i + 1,
            weight_grams: weightKgToGrams(s.weight_kg),
            reps_completed: s.reps,
            is_completed: false,
          })),
          warmupCompleted: [],
          sessionRpe: undefined,
          timerState: null,
          recoveryOffer: null,
          recoveryDismissed: false,
        }),

      initAuxiliary: (work) =>
        set({
          auxiliarySets: work.flatMap(({ exercise, sets }) =>
            sets.map((s, i) => ({
              exercise,
              set_number: i + 1,
              weight_grams: weightKgToGrams(s.weight_kg),
              reps_completed: s.reps,
              is_completed: false,
            }))
          ),
        }),

      updateSet: (setNumber, data) =>
        set((state) => ({
          actualSets: state.actualSets.map((s) =>
            s.set_number === setNumber ? { ...s, ...data } : s
          ),
        })),

      updateAuxiliarySet: (exercise, setNumber, data) =>
        set((state) => ({
          auxiliarySets: state.auxiliarySets.map((s) =>
            s.exercise === exercise && s.set_number === setNumber
              ? { ...s, ...data }
              : s
          ),
        })),

      addAdHocSet: (exercise, initialWeightGrams) =>
        set((state) => {
          const existing = state.auxiliarySets.filter(
            (s) => s.exercise === exercise
          );
          const last = existing[existing.length - 1];
          const weight_grams =
            last?.weight_grams ??
            (initialWeightGrams != null && initialWeightGrams > 0
              ? initialWeightGrams
              : 0);
          return {
            auxiliarySets: [
              ...state.auxiliarySets,
              {
                exercise,
                set_number: existing.length + 1,
                weight_grams,
                reps_completed: last?.reps_completed ?? 5,
                is_completed: false,
              },
            ],
          };
        }),

      removeAdHocSet: (exercise, setNumber) =>
        set((state) => {
          const remaining = state.auxiliarySets
            .filter(
              (s) => !(s.exercise === exercise && s.set_number === setNumber)
            )
            .map((s) => {
              // Renumber sets for the affected exercise
              if (s.exercise === exercise && s.set_number > setNumber) {
                return { ...s, set_number: s.set_number - 1 };
              }
              return s;
            });
          return { auxiliarySets: remaining };
        }),

      setWarmupDone: (index, done) =>
        set((state) => ({
          warmupCompleted: done
            ? state.warmupCompleted.includes(index)
              ? state.warmupCompleted
              : [...state.warmupCompleted, index]
            : state.warmupCompleted.filter((i) => i !== index),
        })),

      setSessionRpe: (rpe) => set({ sessionRpe: rpe }),

      setSessionMeta: (meta) => set({ sessionMeta: meta }),

      setCachedJitData: (raw) => set({ cachedJitData: raw }),

      setCachedPrescriptionTrace: (raw) => set({ cachedPrescriptionTrace: raw }),

      recordSetFailure: () =>
        set((state) => ({
          consecutiveMainLiftFailures: state.consecutiveMainLiftFailures + 1,
        })),

      recordSetSuccess: () =>
        set({
          consecutiveMainLiftFailures: 0,
          currentAdaptation: null,
        }),

      setAdaptation: (plan) => set({ currentAdaptation: plan }),

      resetAdaptation: () =>
        set({
          consecutiveMainLiftFailures: 0,
          currentAdaptation: null,
        }),

      setRecoveryOffer: (offer) => set({ recoveryOffer: offer }),

      acceptRecovery: () =>
        set((state) => {
          const offer = state.recoveryOffer;
          if (!offer) return {};
          const currentCount = state.plannedSets.length;
          const newPlanned = [
            ...state.plannedSets,
            ...offer.recoveredSets.map((s) => ({
              weight_kg: s.weight_kg,
              reps: s.reps,
            })),
          ];
          const newActual = [
            ...state.actualSets,
            ...offer.recoveredSets.map((s, i) => ({
              set_number: currentCount + i + 1,
              weight_grams: weightKgToGrams(s.weight_kg),
              reps_completed: s.reps,
              is_completed: false,
              is_recovered: true,
            })),
          ];
          return {
            plannedSets: newPlanned,
            actualSets: newActual,
            recoveryOffer: null,
          };
        }),

      dismissRecovery: () =>
        set({ recoveryOffer: null, recoveryDismissed: true }),

      openTimer: ({
        durationSeconds,
        pendingMainSetNumber,
        pendingAuxExercise,
        pendingAuxSetNumber,
      }) =>
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

      tickTimer: () =>
        set((state) => {
          const t = state.timerState;
          if (!t || !t.timerStartedAt) return {};
          return {
            timerState: {
              ...t,
              elapsed: Math.floor((Date.now() - t.timerStartedAt) / 1000),
            },
          };
        }),

      adjustTimer: (deltaSecs) =>
        set((state) => {
          const t = state.timerState;
          if (!t) return {};
          const nextOffset = Math.max(-t.durationSeconds, t.offset + deltaSecs);
          return { timerState: { ...t, offset: nextOffset } };
        }),

      closeTimer: () => {
        const elapsed = get().timerState?.elapsed ?? 0;
        set({ timerState: null });
        return elapsed;
      },

      reset: () =>
        set({
          sessionId: null,
          plannedSets: [],
          actualSets: [],
          auxiliarySets: [],
          warmupCompleted: [],
          sessionRpe: undefined,
          startedAt: undefined,
          sessionMeta: null,
          cachedJitData: null,
          cachedPrescriptionTrace: null,
          timerState: null,
          consecutiveMainLiftFailures: 0,
          currentAdaptation: null,
          recoveryOffer: null,
          recoveryDismissed: false,
        }),
    }),
    {
      name: 'parakeet-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        plannedSets: state.plannedSets,
        actualSets: state.actualSets,
        auxiliarySets: state.auxiliarySets,
        warmupCompleted: state.warmupCompleted,
        sessionRpe: state.sessionRpe,
        sessionMeta: state.sessionMeta,
        cachedJitData: state.cachedJitData,
        cachedPrescriptionTrace: state.cachedPrescriptionTrace,
        timerState: state.timerState,
        startedAt: state.startedAt,
        recoveryDismissed: state.recoveryDismissed,
      }),
      merge: (persisted, current) => {
        const raw = persisted as Partial<Record<string, unknown>> | undefined;
        const p = persisted as Partial<SessionState> | undefined;
        return {
          ...current,
          ...p,
          startedAt:
            typeof raw?.startedAt === 'string'
              ? new Date(raw.startedAt)
              : undefined,
        };
      },
    }
  )
);

export function getReadyCachedJitData(): Promise<string | null> {
  return new Promise((resolve) => {
    const current = useSessionStore.getState().cachedJitData;
    if (current) {
      resolve(current);
      return;
    }

    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, 2000);

    const unsubscribe = useSessionStore.subscribe((state) => {
      if (state.cachedJitData) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(state.cachedJitData);
      }
    });
  });
}

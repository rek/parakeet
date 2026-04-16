import type {
  AuxSessionAdaptation,
  AuxiliaryWork,
  PendingAuxConfirmation,
  PostRestState,
  RecoveryOffer,
  SessionAdaptation,
  SupersetGroup,
  WeightSuggestionOffer,
} from '@modules/session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { weightKgToGrams } from '@shared/utils/weight';
import { getEffectivePlannedSet } from '@shared/utils/getEffectivePlannedSet';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface ActualSet {
  set_number: number;
  weight_grams: number;
  reps_completed: number;
  rpe_actual?: number;
  is_completed: boolean;
  actual_rest_seconds?: number;
  is_recovered?: boolean;
  /** True when the lifter pressed "Failed" on the PostRestOverlay. */
  failed?: boolean;
}

export interface AuxiliaryActualSet {
  exercise: string;
  set_number: number;
  weight_grams: number;
  reps_completed: number;
  rpe_actual?: number;
  is_completed: boolean;
  actual_rest_seconds?: number;
  exercise_type?: 'weighted' | 'bodyweight' | 'timed';
  /** True when the lifter pressed "Failed" on the PostRestOverlay. */
  failed?: boolean;
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
  supersetGroup?: SupersetGroup;
}

export interface SessionState {
  sessionId: string | null;
  plannedSets: { weight_kg: number; reps: number }[];
  actualSets: ActualSet[];
  auxiliarySets: AuxiliaryActualSet[];
  auxiliaryWork: AuxiliaryWork[];
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
  currentAdaptation: SessionAdaptation | null;
  /** Per-exercise aux adaptations keyed by exercise name */
  auxAdaptations: Record<string, AuxSessionAdaptation>;
  recoveryOffer: RecoveryOffer | null;
  recoveryDismissed: boolean;
  weightSuggestion: WeightSuggestionOffer | null;
  hasAcceptedWeightSuggestion: boolean;
  postRestState: PostRestState | null;
  pendingRpeSetNumber: number | null;
  pendingAuxRpe: { exercise: string; setNumber: number } | null;
  pendingAuxConfirmation: PendingAuxConfirmation | null;

  updateSet: (setNumber: number, data: Partial<ActualSet>) => void;
  updateAuxiliarySet: (
    exercise: string,
    setNumber: number,
    data: Partial<AuxiliaryActualSet>
  ) => void;
  addAdHocSet: (
    exercise: string,
    initialWeightGrams?: number,
    exerciseType?: 'weighted' | 'bodyweight' | 'timed'
  ) => void;
  removeAdHocSet: (exercise: string, setNumber: number) => void;
  setWarmupDone: (index: number, done: boolean) => void;
  setSessionRpe: (rpe: number) => void;
  initSession: (
    sessionId: string,
    plannedSets: { weight_kg: number; reps: number }[]
  ) => void;
  initAuxiliary: (
    work: {
      exercise: string;
      sets: { weight_kg: number; reps: number }[];
      exerciseType?: 'weighted' | 'bodyweight' | 'timed';
    }[]
  ) => void;
  initAuxiliaryWork: (work: AuxiliaryWork[]) => void;
  setSessionMeta: (meta: SessionState['sessionMeta']) => void;
  setCachedJitData: (raw: string) => void;
  setCachedPrescriptionTrace: (raw: string) => void;
  recordSetFailure: () => void;
  recordSetSuccess: () => void;
  setAdaptation: (plan: SessionAdaptation) => void;
  setAuxAdaptation: (exercise: string, plan: AuxSessionAdaptation) => void;
  resetAdaptation: () => void;
  setRecoveryOffer: (offer: RecoveryOffer) => void;
  acceptRecovery: () => void;
  dismissRecovery: () => void;
  setWeightSuggestion: (suggestion: WeightSuggestionOffer | null) => void;
  acceptWeightSuggestion: () => void;
  dismissWeightSuggestion: () => void;
  openTimer: (opts: {
    durationSeconds: number;
    pendingMainSetNumber?: number;
    pendingAuxExercise?: string;
    pendingAuxSetNumber?: number;
  }) => void;
  tickTimer: () => void;
  adjustTimer: (deltaSecs: number) => void;
  closeTimer: () => number;
  showMainPostRest: (pendingMainSetNumber: number, elapsedSeconds: number) => void;
  showAuxPostRest: (
    pendingAuxExercise: string,
    pendingAuxSetNumber: number,
    elapsedSeconds: number
  ) => void;
  showWarmupPostRest: (elapsedSeconds: number) => void;
  clearPostRestState: () => void;
  extendPostRest: () => void;
  tickPostRestCountdown: () => void;
  setPendingRpe: (setNumber: number) => void;
  setPendingAuxRpe: (exercise: string, setNumber: number) => void;
  clearPendingRpe: () => void;
  setPendingAuxConfirmation: (data: PendingAuxConfirmation) => void;
  clearPendingAuxConfirmation: () => void;
  registerSupersetGroup: (group: Omit<SupersetGroup, 'currentIndex'>) => void;
  advanceSuperset: (groupId: string) => void;
  clearSupersetGroup: (groupId: string) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      plannedSets: [],
      actualSets: [],
      auxiliarySets: [],
      auxiliaryWork: [],
      warmupCompleted: [],
      sessionRpe: undefined,
      startedAt: undefined,
      sessionMeta: null,
      cachedJitData: null,
      cachedPrescriptionTrace: null,
      timerState: null,
      consecutiveMainLiftFailures: 0,
      currentAdaptation: null,
      auxAdaptations: {},
      recoveryOffer: null,
      recoveryDismissed: false,
      weightSuggestion: null,
      hasAcceptedWeightSuggestion: false,
      postRestState: null,
      pendingRpeSetNumber: null,
      pendingAuxRpe: null,
      pendingAuxConfirmation: null,

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
          auxiliaryWork: [],
          warmupCompleted: [],
          sessionRpe: undefined,
          timerState: null,
          recoveryOffer: null,
          recoveryDismissed: false,
          weightSuggestion: null,
          hasAcceptedWeightSuggestion: false,
          postRestState: null,
          pendingRpeSetNumber: null,
          pendingAuxRpe: null,
          pendingAuxConfirmation: null,
        }),

      initAuxiliary: (work) =>
        set({
          auxiliarySets: work.flatMap(({ exercise, sets, exerciseType }) =>
            sets.map((s, i) => ({
              exercise,
              set_number: i + 1,
              weight_grams: weightKgToGrams(s.weight_kg),
              reps_completed: s.reps,
              is_completed: false,
              exercise_type: exerciseType,
            }))
          ),
        }),

      initAuxiliaryWork: (work) => set({ auxiliaryWork: work }),

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

      addAdHocSet: (exercise, initialWeightGrams, exerciseType) =>
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
                exercise_type: exerciseType ?? last?.exercise_type,
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

      setCachedPrescriptionTrace: (raw) =>
        set({ cachedPrescriptionTrace: raw }),

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

      setAuxAdaptation: (exercise, plan) =>
        set((state) => ({
          auxAdaptations: { ...state.auxAdaptations, [exercise]: plan },
        })),

      resetAdaptation: () =>
        set({
          consecutiveMainLiftFailures: 0,
          currentAdaptation: null,
          auxAdaptations: {},
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

      setWeightSuggestion: (suggestion) =>
        set({ weightSuggestion: suggestion }),

      acceptWeightSuggestion: () =>
        set((state) => {
          const suggestion = state.weightSuggestion;
          if (!suggestion) return {};
          const newWeightGrams = weightKgToGrams(suggestion.suggestedWeightKg);
          // Cascade to all remaining incomplete sets so the bump propagates
          const updatedActual = state.actualSets.map((s) =>
            s.is_completed ? s : { ...s, weight_grams: newWeightGrams }
          );
          return {
            actualSets: updatedActual,
            weightSuggestion: null,
            hasAcceptedWeightSuggestion: true,
          };
        }),

      dismissWeightSuggestion: () => set({ weightSuggestion: null }),

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

      showMainPostRest: (pendingMainSetNumber, elapsedSeconds) =>
        set((state) => {
          const nextSet = getEffectivePlannedSet(
            pendingMainSetNumber,
            state.plannedSets,
            state.actualSets,
            state.currentAdaptation
          );
          if (!nextSet) return {};
          return {
            postRestState: {
              pendingMainSetNumber,
              pendingAuxExercise: null,
              pendingAuxSetNumber: null,
              actualRestSeconds: elapsedSeconds,
              liftStartedAt: Date.now(),
              plannedReps: nextSet.reps,
              plannedWeightKg: null, // Derived live from selectPostRestWeight
              nextSetNumber: pendingMainSetNumber + 1,
              resetSecondsRemaining: null,
            },
          };
        }),

      showAuxPostRest: (pendingAuxExercise, pendingAuxSetNumber, elapsedSeconds) =>
        set((state) => {
          const auxWork = state.auxiliaryWork.find((w) => w.exercise === pendingAuxExercise);
          const auxSetPlan = auxWork?.sets[pendingAuxSetNumber - 1];
          if (!auxSetPlan) return {};
          return {
            postRestState: {
              pendingMainSetNumber: null,
              pendingAuxExercise,
              pendingAuxSetNumber,
              actualRestSeconds: elapsedSeconds,
              liftStartedAt: Date.now(),
              plannedReps: auxSetPlan.reps,
              plannedWeightKg: auxSetPlan.weight_kg,
              nextSetNumber: null,
              resetSecondsRemaining: null,
            },
          };
        }),

      showWarmupPostRest: (elapsedSeconds) =>
        set((state) => {
          const firstSet = getEffectivePlannedSet(
            0,
            state.plannedSets,
            state.actualSets,
            state.currentAdaptation
          );
          return {
            postRestState: {
              pendingMainSetNumber: null,
              pendingAuxExercise: null,
              pendingAuxSetNumber: null,
              actualRestSeconds: elapsedSeconds,
              liftStartedAt: Date.now(),
              plannedReps: firstSet?.reps ?? 0,
              plannedWeightKg: firstSet?.weight_kg ?? null,
              nextSetNumber: 1,
              resetSecondsRemaining: null,
            },
          };
        }),

      clearPostRestState: () => set({ postRestState: null }),

      extendPostRest: () =>
        set((state) => {
          const prs = state.postRestState;
          if (!prs) return {};
          const newRest = prs.actualRestSeconds + 15;
          return {
            postRestState: {
              ...prs,
              actualRestSeconds: newRest,
              resetSecondsRemaining: 15,
            },
          };
        }),

      tickPostRestCountdown: () =>
        set((state) => {
          const prs = state.postRestState;
          if (!prs || prs.resetSecondsRemaining === null) return {};
          const next = prs.resetSecondsRemaining - 1;
          if (next <= 0) {
            return {
              postRestState: {
                ...prs,
                resetSecondsRemaining: null,
              },
            };
          }
          return {
            postRestState: {
              ...prs,
              resetSecondsRemaining: next,
            },
          };
        }),

      setPendingRpe: (setNumber) => set({ pendingRpeSetNumber: setNumber }),

      setPendingAuxRpe: (exercise, setNumber) =>
        set({ pendingAuxRpe: { exercise, setNumber } }),

      clearPendingRpe: () =>
        set({ pendingRpeSetNumber: null, pendingAuxRpe: null }),

      setPendingAuxConfirmation: (data) =>
        set({ pendingAuxConfirmation: data }),

      clearPendingAuxConfirmation: () =>
        set({ pendingAuxConfirmation: null }),

      registerSupersetGroup: (group) =>
        set((state) => {
          if (!state.timerState) return {};
          return {
            timerState: {
              ...state.timerState,
              supersetGroup: {
                ...group,
                currentIndex: 0,
              },
            },
          };
        }),

      advanceSuperset: (groupId) =>
        set((state) => {
          const sg = state.timerState?.supersetGroup;
          if (!sg || sg.groupId !== groupId) return {};
          return {
            timerState: state.timerState
              ? {
                  ...state.timerState,
                  supersetGroup: {
                    ...sg,
                    currentIndex: sg.currentIndex + 1,
                  },
                }
              : null,
          };
        }),

      clearSupersetGroup: (groupId) =>
        set((state) => {
          const sg = state.timerState?.supersetGroup;
          if (!sg || sg.groupId !== groupId) return {};
          return {
            timerState: state.timerState
              ? {
                  ...state.timerState,
                  supersetGroup: undefined,
                }
              : null,
          };
        }),

      reset: () =>
        set({
          sessionId: null,
          plannedSets: [],
          actualSets: [],
          auxiliarySets: [],
          auxiliaryWork: [],
          warmupCompleted: [],
          sessionRpe: undefined,
          startedAt: undefined,
          sessionMeta: null,
          cachedJitData: null,
          cachedPrescriptionTrace: null,
          timerState: null,
          consecutiveMainLiftFailures: 0,
          currentAdaptation: null,
          auxAdaptations: {},
          recoveryOffer: null,
          recoveryDismissed: false,
          weightSuggestion: null,
          hasAcceptedWeightSuggestion: false,
          postRestState: null,
          pendingRpeSetNumber: null,
          pendingAuxRpe: null,
          pendingAuxConfirmation: null,
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

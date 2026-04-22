import type {
  AuxSessionAdaptation,
  AuxiliaryWork,
  PendingAuxConfirmation,
  PostRestState,
  RecoveryOffer,
  SessionAdaptation,
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
  /** ISO timestamp — set when persistSet successfully writes to set_logs. */
  synced_at?: string;
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
  /** ISO timestamp — set when persistSet successfully writes to set_logs. */
  synced_at?: string;
}

export interface TimerState {
  visible: boolean;
  durationSeconds: number;
  elapsed: number;
  offset: number;
  timerStartedAt: number | null;
  pendingMainSetNumber: number | null;
  pendingAuxExercise: string | null;
  pendingAuxSetNumber: number | null;
}

/** Derive a stable key for a timer from its pending set info. */
export function deriveTimerKey(opts: {
  pendingMainSetNumber?: number | null;
  pendingAuxExercise?: string | null;
}): string {
  if (opts.pendingMainSetNumber != null) return 'main';
  if (opts.pendingAuxExercise) return opts.pendingAuxExercise;
  return 'warmup';
}

// ── Selectors ──────────────────────────────────────────────────────────────────

export function selectActiveTimer(state: SessionState): TimerState | null {
  if (!state.activeTimerKey) return null;
  return state.timers[state.activeTimerKey] ?? null;
}

export function selectTimerCount(state: SessionState): number {
  return Object.keys(state.timers).length;
}

export function selectBackgroundTimers(
  state: SessionState
): Array<{ key: string; timer: TimerState }> {
  return Object.entries(state.timers)
    .filter(([key]) => key !== state.activeTimerKey)
    .map(([key, timer]) => ({ key, timer }));
}

export function selectActivePostRest(state: SessionState): PostRestState | null {
  return state.postRestQueue[0] ?? null;
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
  timers: Record<string, TimerState>;
  activeTimerKey: string | null;
  consecutiveMainLiftFailures: number;
  currentAdaptation: SessionAdaptation | null;
  /** Per-exercise aux adaptations keyed by exercise name */
  auxAdaptations: Record<string, AuxSessionAdaptation>;
  recoveryOffer: RecoveryOffer | null;
  recoveryDismissed: boolean;
  weightSuggestion: WeightSuggestionOffer | null;
  hasAcceptedWeightSuggestion: boolean;
  postRestQueue: PostRestState[];
  pendingRpeSetNumber: number | null;
  pendingAuxRpe: { exercise: string; setNumber: number } | null;
  pendingAuxConfirmation: PendingAuxConfirmation | null;

  updateSet: (setNumber: number, data: Partial<ActualSet>) => void;
  updateAuxiliarySet: (
    exercise: string,
    setNumber: number,
    data: Partial<AuxiliaryActualSet>
  ) => void;
  /** Writes synced_at for a primary set — called when its set_logs row is persisted. */
  markSetSynced: (setNumber: number, syncedAt: string) => void;
  /** Writes synced_at for an auxiliary set — called when its set_logs row is persisted. */
  markAuxSetSynced: (
    exercise: string,
    setNumber: number,
    syncedAt: string
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
  closeTimer: (key?: string) => number;
  switchActiveTimer: (key: string) => void;
  completeExpiredTimers: () => void;
  showMainPostRest: (pendingMainSetNumber: number, elapsedSeconds: number) => void;
  showAuxPostRest: (
    pendingAuxExercise: string,
    pendingAuxSetNumber: number,
    elapsedSeconds: number
  ) => void;
  showWarmupPostRest: (elapsedSeconds: number) => void;
  /** Remove the first item from postRestQueue. */
  clearPostRestState: () => void;
  extendPostRest: () => void;
  tickPostRestCountdown: () => void;
  setPendingRpe: (setNumber: number) => void;
  setPendingAuxRpe: (exercise: string, setNumber: number) => void;
  clearPendingRpe: () => void;
  setPendingAuxConfirmation: (data: PendingAuxConfirmation) => void;
  clearPendingAuxConfirmation: () => void;
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
      timers: {},
      activeTimerKey: null,
      consecutiveMainLiftFailures: 0,
      currentAdaptation: null,
      auxAdaptations: {},
      recoveryOffer: null,
      recoveryDismissed: false,
      weightSuggestion: null,
      hasAcceptedWeightSuggestion: false,
      postRestQueue: [],
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
          timers: {},
          activeTimerKey: null,
          recoveryOffer: null,
          recoveryDismissed: false,
          weightSuggestion: null,
          hasAcceptedWeightSuggestion: false,
          postRestQueue: [],
          pendingRpeSetNumber: null,
          pendingAuxRpe: null,
          pendingAuxConfirmation: null,
          consecutiveMainLiftFailures: 0,
          currentAdaptation: null,
          auxAdaptations: {},
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
          actualSets: state.actualSets.map((s) => {
            if (s.set_number !== setNumber) return s;
            // User-driven edits invalidate prior sync state so the persistence
            // subscriber re-syncs the updated values.
            const invalidate =
              data.is_completed !== undefined
              || data.weight_grams !== undefined
              || data.reps_completed !== undefined
              || data.rpe_actual !== undefined
              || data.actual_rest_seconds !== undefined
              || data.failed !== undefined;
            return {
              ...s,
              ...data,
              synced_at: invalidate ? undefined : s.synced_at,
            };
          }),
        })),

      updateAuxiliarySet: (exercise, setNumber, data) =>
        set((state) => ({
          auxiliarySets: state.auxiliarySets.map((s) => {
            if (s.exercise !== exercise || s.set_number !== setNumber) return s;
            const invalidate =
              data.is_completed !== undefined
              || data.weight_grams !== undefined
              || data.reps_completed !== undefined
              || data.rpe_actual !== undefined
              || data.actual_rest_seconds !== undefined
              || data.failed !== undefined;
            return {
              ...s,
              ...data,
              synced_at: invalidate ? undefined : s.synced_at,
            };
          }),
        })),

      markSetSynced: (setNumber, syncedAt) =>
        set((state) => ({
          actualSets: state.actualSets.map((s) =>
            s.set_number === setNumber ? { ...s, synced_at: syncedAt } : s
          ),
        })),

      markAuxSetSynced: (exercise, setNumber, syncedAt) =>
        set((state) => ({
          auxiliarySets: state.auxiliarySets.map((s) =>
            s.exercise === exercise && s.set_number === setNumber
              ? { ...s, synced_at: syncedAt }
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
        set((state) => {
          const key = deriveTimerKey({
            pendingMainSetNumber,
            pendingAuxExercise,
          });
          const newTimer: TimerState = {
            visible: true,
            durationSeconds,
            elapsed: 0,
            offset: 0,
            timerStartedAt: Date.now(),
            pendingMainSetNumber: pendingMainSetNumber ?? null,
            pendingAuxExercise: pendingAuxExercise ?? null,
            pendingAuxSetNumber: pendingAuxSetNumber ?? null,
          };
          // Main lift always takes visual precedence
          const activeKey =
            state.timers['main'] && key !== 'main'
              ? 'main'
              : key;
          return {
            timers: { ...state.timers, [key]: newTimer },
            activeTimerKey: activeKey,
          };
        }),

      tickTimer: () =>
        set((state) => {
          const now = Date.now();
          const entries = Object.entries(state.timers);
          if (entries.length === 0) return {};
          const updated: Record<string, TimerState> = {};
          for (const [key, t] of entries) {
            updated[key] = t.timerStartedAt
              ? { ...t, elapsed: Math.floor((now - t.timerStartedAt) / 1000) }
              : t;
          }
          return { timers: updated };
        }),

      adjustTimer: (deltaSecs) =>
        set((state) => {
          const key = state.activeTimerKey;
          if (!key || !state.timers[key]) return {};
          const t = state.timers[key];
          const nextOffset = Math.max(-t.durationSeconds, t.offset + deltaSecs);
          return {
            timers: { ...state.timers, [key]: { ...t, offset: nextOffset } },
          };
        }),

      closeTimer: (key?: string) => {
        const state = get();
        const targetKey = key ?? state.activeTimerKey;
        if (!targetKey || !state.timers[targetKey]) return 0;
        const elapsed = state.timers[targetKey].elapsed;
        const { [targetKey]: _, ...remaining } = state.timers;
        // Promote next active key
        let newActive = state.activeTimerKey;
        if (targetKey === state.activeTimerKey) {
          const keys = Object.keys(remaining);
          newActive = keys.includes('main')
            ? 'main'
            : (keys[keys.length - 1] ?? null);
        }
        set({ timers: remaining, activeTimerKey: newActive });
        return elapsed;
      },

      switchActiveTimer: (key: string) =>
        set((state) => {
          if (!state.timers[key]) return {};
          return { activeTimerKey: key };
        }),

      completeExpiredTimers: () =>
        set((state) => {
          const entries = Object.entries(state.timers);
          if (entries.length <= 1) return {}; // Only background timers expire
          const remaining: Record<string, TimerState> = {};
          const newQueue = [...state.postRestQueue];
          for (const [key, t] of entries) {
            if (key === state.activeTimerKey) {
              remaining[key] = t;
              continue;
            }
            const effectiveDuration = t.durationSeconds + t.offset;
            if (t.elapsed >= effectiveDuration) {
              // Background timer expired — build PostRestState
              if (t.pendingAuxExercise !== null && t.pendingAuxSetNumber !== null) {
                const auxWork = state.auxiliaryWork.find(
                  (w) => w.exercise === t.pendingAuxExercise
                );
                const auxSetPlan = auxWork?.sets[t.pendingAuxSetNumber];
                if (auxSetPlan) {
                  newQueue.push({
                    pendingMainSetNumber: null,
                    pendingAuxExercise: t.pendingAuxExercise,
                    pendingAuxSetNumber: t.pendingAuxSetNumber,
                    actualRestSeconds: t.elapsed,
                    liftStartedAt: Date.now(),
                    plannedReps: auxSetPlan.reps,
                    plannedWeightKg: auxSetPlan.weight_kg,
                    nextSetNumber: null,
                    resetSecondsRemaining: null,
                  });
                }
              } else if (t.pendingMainSetNumber !== null) {
                const nextSet = getEffectivePlannedSet(
                  t.pendingMainSetNumber,
                  state.plannedSets,
                  state.actualSets,
                  state.currentAdaptation
                );
                if (nextSet) {
                  newQueue.push({
                    pendingMainSetNumber: t.pendingMainSetNumber,
                    pendingAuxExercise: null,
                    pendingAuxSetNumber: null,
                    actualRestSeconds: t.elapsed,
                    liftStartedAt: Date.now(),
                    plannedReps: nextSet.reps,
                    plannedWeightKg: null,
                    nextSetNumber: t.pendingMainSetNumber + 1,
                    resetSecondsRemaining: null,
                  });
                }
              }
            } else {
              remaining[key] = t;
            }
          }
          if (Object.keys(remaining).length === entries.length) return {};
          let newActive = state.activeTimerKey;
          if (newActive && !remaining[newActive]) {
            const keys = Object.keys(remaining);
            newActive = keys.includes('main')
              ? 'main'
              : (keys[keys.length - 1] ?? null);
          }
          return {
            timers: remaining,
            activeTimerKey: newActive,
            postRestQueue: newQueue,
          };
        }),

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
            postRestQueue: [
              ...state.postRestQueue,
              {
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
            ],
          };
        }),

      showAuxPostRest: (pendingAuxExercise, pendingAuxSetNumber, elapsedSeconds) =>
        set((state) => {
          const auxWork = state.auxiliaryWork.find((w) => w.exercise === pendingAuxExercise);
          const auxSetPlan = auxWork?.sets[pendingAuxSetNumber];
          if (!auxSetPlan) return {};
          return {
            postRestQueue: [
              ...state.postRestQueue,
              {
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
            ],
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
            postRestQueue: [
              ...state.postRestQueue,
              {
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
            ],
          };
        }),

      clearPostRestState: () =>
        set((state) => ({
          postRestQueue: state.postRestQueue.slice(1),
        })),

      extendPostRest: () =>
        set((state) => {
          if (state.postRestQueue.length === 0) return {};
          const [first, ...rest] = state.postRestQueue;
          return {
            postRestQueue: [
              { ...first, actualRestSeconds: first.actualRestSeconds + 15, resetSecondsRemaining: 15 },
              ...rest,
            ],
          };
        }),

      tickPostRestCountdown: () =>
        set((state) => {
          if (state.postRestQueue.length === 0) return {};
          const [first, ...rest] = state.postRestQueue;
          if (first.resetSecondsRemaining === null) return {};
          const next = first.resetSecondsRemaining - 1;
          return {
            postRestQueue: [
              { ...first, resetSecondsRemaining: next <= 0 ? null : next },
              ...rest,
            ],
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
          timers: {},
          activeTimerKey: null,
          consecutiveMainLiftFailures: 0,
          currentAdaptation: null,
          auxAdaptations: {},
          recoveryOffer: null,
          recoveryDismissed: false,
          weightSuggestion: null,
          hasAcceptedWeightSuggestion: false,
          postRestQueue: [],
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
        timers: state.timers,
        activeTimerKey: state.activeTimerKey,
        startedAt: state.startedAt,
        recoveryDismissed: state.recoveryDismissed,
      }),
      merge: (persisted, current) => {
        const raw = persisted as Partial<Record<string, unknown>> | undefined;
        const p = persisted as Partial<SessionState> | undefined;

        // Migrate old single timerState → timers dict
        let timers = p?.timers ?? {};
        if (!p?.timers && raw?.timerState) {
          const old = raw.timerState as TimerState;
          const key = deriveTimerKey({
            pendingMainSetNumber: old.pendingMainSetNumber,
            pendingAuxExercise: old.pendingAuxExercise,
          });
          timers = { [key]: old };
        }

        // Migrate old single postRestState → postRestQueue
        let postRestQueue = p?.postRestQueue ?? [];
        if (
          (!p?.postRestQueue || p.postRestQueue.length === 0) &&
          raw?.postRestState
        ) {
          postRestQueue = [raw.postRestState as PostRestState];
        }

        return {
          ...current,
          ...p,
          timers,
          activeTimerKey:
            p?.activeTimerKey ?? Object.keys(timers)[0] ?? null,
          postRestQueue,
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

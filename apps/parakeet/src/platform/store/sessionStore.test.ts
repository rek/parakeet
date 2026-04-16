import type { SessionState } from './sessionStore';
import { useSessionStore } from './sessionStore';
import { selectPostRestWeight } from '@modules/session';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPersistOptions(store: unknown): {
  partialize: (state: SessionState) => Partial<SessionState>;
  merge: (persisted: unknown, current: SessionState) => SessionState;
} {
  return (store as any).persist.getOptions();
}

describe('sessionStore persistence', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('startedAt round-trips through JSON serialization via merge', () => {
    const store = useSessionStore;
    store.getState().initSession('s1', [{ weight_kg: 100, reps: 5 }]);

    const state = store.getState();
    expect(state.startedAt).toBeInstanceOf(Date);

    // Simulate Zustand persist round-trip: partialize → JSON.stringify → JSON.parse → merge
    const opts = getPersistOptions(store);

    const partialized = opts.partialize(state);
    const serialized = JSON.parse(JSON.stringify(partialized));

    // After JSON round-trip, startedAt is a string
    expect(typeof serialized.startedAt).toBe('string');

    // merge should reconstruct it as a Date
    const merged = opts.merge(serialized, store.getState());
    expect(merged.startedAt).toBeInstanceOf(Date);
    expect(merged.startedAt!.toISOString()).toBe(
      state.startedAt!.toISOString()
    );
  });

  it('merge handles missing startedAt gracefully', () => {
    const opts = getPersistOptions(useSessionStore);
    const merged = opts.merge({}, useSessionStore.getState());
    expect(merged.startedAt).toBeUndefined();
  });

  it('merge handles undefined persisted state', () => {
    const opts = getPersistOptions(useSessionStore);
    const merged = opts.merge(undefined, useSessionStore.getState());
    expect(merged.startedAt).toBeUndefined();
  });

  it('merge preserves warmupCompleted array from persisted state', () => {
    const opts = getPersistOptions(useSessionStore);
    const merged = opts.merge(
      { warmupCompleted: [1, 2, 3] },
      useSessionStore.getState()
    );
    expect(Array.isArray(merged.warmupCompleted)).toBe(true);
    expect(merged.warmupCompleted).toEqual([1, 2, 3]);
  });
});

describe('sessionStore.acceptWeightSuggestion', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('cascades the new weight to all incomplete sets', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [
      { weight_kg: 100, reps: 5 },
      { weight_kg: 100, reps: 5 },
      { weight_kg: 100, reps: 5 },
    ]);
    store.updateSet(1, {
      weight_grams: 100_000,
      reps_completed: 5,
      is_completed: true,
    });
    store.setWeightSuggestion({
      suggestedWeightKg: 105,
      deltaKg: 5,
      rationale: 'felt easy',
    });

    useSessionStore.getState().acceptWeightSuggestion();

    const after = useSessionStore.getState().actualSets;
    expect(after).toHaveLength(3);
    // Completed set unchanged
    expect(after[0]).toMatchObject({
      set_number: 1,
      weight_grams: 100_000,
      is_completed: true,
    });
    // Both remaining incomplete sets bumped
    expect(after[1]).toMatchObject({
      set_number: 2,
      weight_grams: 105_000,
      is_completed: false,
    });
    expect(after[2]).toMatchObject({
      set_number: 3,
      weight_grams: 105_000,
      is_completed: false,
    });
    // Banner cleared, accept flag set
    const state = useSessionStore.getState();
    expect(state.weightSuggestion).toBeNull();
    expect(state.hasAcceptedWeightSuggestion).toBe(true);
  });

  it('is a no-op when no suggestion is active', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
    const before = useSessionStore.getState().actualSets;

    useSessionStore.getState().acceptWeightSuggestion();

    expect(useSessionStore.getState().actualSets).toEqual(before);
    expect(useSessionStore.getState().hasAcceptedWeightSuggestion).toBe(false);
  });
});

describe('sessionStore post-rest state machine', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  describe('showMainPostRest', () => {
    it('sets postRestState with correct planned reps and weight for next set', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [
        { weight_kg: 100, reps: 5 },
        { weight_kg: 105, reps: 3 },
      ]);

      store.showMainPostRest(1, 180);

      const state = useSessionStore.getState().postRestState;
      expect(state).toMatchObject({
        pendingMainSetNumber: 1,
        pendingAuxExercise: null,
        pendingAuxSetNumber: null,
        actualRestSeconds: 180,
        plannedReps: 3,
        plannedWeightKg: null, // Derived live via selector
        resetSecondsRemaining: null,
      });
    });

    it('is a no-op if set index is out of bounds', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
      const before = useSessionStore.getState().postRestState;

      store.showMainPostRest(5, 180);

      expect(useSessionStore.getState().postRestState).toEqual(before);
    });
  });

  describe('showAuxPostRest', () => {
    it('sets postRestState with aux plan data for next set', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
      store.initAuxiliaryWork([
        {
          exercise: 'leg-curl',
          sets: [
            { weight_kg: 50, reps: 10 },
            { weight_kg: 55, reps: 8 },
          ],
          skipped: false,
        },
      ]);

      store.showAuxPostRest('leg-curl', 1, 90);

      const state = useSessionStore.getState().postRestState;
      expect(state).toMatchObject({
        pendingMainSetNumber: null,
        pendingAuxExercise: 'leg-curl',
        pendingAuxSetNumber: 1,
        actualRestSeconds: 90,
        plannedReps: 8, // Next set (index 1)
        plannedWeightKg: 55,
      });
    });

    it('is a no-op if exercise or set is not found', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
      const before = useSessionStore.getState().postRestState;

      store.showAuxPostRest('nonexistent', 1, 90);

      expect(useSessionStore.getState().postRestState).toEqual(before);
    });
  });

  describe('extendPostRest', () => {
    it('adds 15 seconds and starts countdown', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
      store.showMainPostRest(0, 180);

      store.extendPostRest();

      const state = useSessionStore.getState().postRestState;
      expect(state?.actualRestSeconds).toBe(195);
      expect(state?.resetSecondsRemaining).toBe(15);
    });

    it('is a no-op if no post-rest active', () => {
      const store = useSessionStore.getState();
      const before = useSessionStore.getState().postRestState;

      store.extendPostRest();

      expect(useSessionStore.getState().postRestState).toEqual(before);
    });
  });

  describe('tickPostRestCountdown', () => {
    it('decrements resetSecondsRemaining each tick', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
      store.showMainPostRest(0, 180);
      store.extendPostRest();

      expect(store.postRestState?.resetSecondsRemaining).toBe(15);

      store.tickPostRestCountdown();
      expect(useSessionStore.getState().postRestState?.resetSecondsRemaining).toBe(14);

      store.tickPostRestCountdown();
      expect(useSessionStore.getState().postRestState?.resetSecondsRemaining).toBe(13);
    });

    it('clears countdown when reaching zero', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
      store.showMainPostRest(0, 180);
      store.extendPostRest(); // resetSecondsRemaining = 15

      for (let i = 0; i < 15; i++) {
        store.tickPostRestCountdown();
      }

      expect(useSessionStore.getState().postRestState?.resetSecondsRemaining).toBe(null);
    });
  });

  describe('clearPostRestState', () => {
    it('clears post-rest state', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
      store.showMainPostRest(0, 180);

      expect(store.postRestState).not.toBeNull();

      store.clearPostRestState();

      expect(useSessionStore.getState().postRestState).toBeNull();
    });
  });
});

describe('sessionStore pending RPE state', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  describe('setPendingRpe', () => {
    it('sets main lift RPE request', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

      store.setPendingRpe(1);

      expect(useSessionStore.getState().pendingRpeSetNumber).toBe(1);
    });
  });

  describe('setPendingAuxRpe', () => {
    it('sets aux exercise RPE request', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

      store.setPendingAuxRpe('leg-curl', 2);

      const state = useSessionStore.getState().pendingAuxRpe;
      expect(state).toMatchObject({
        exercise: 'leg-curl',
        setNumber: 2,
      });
    });
  });

  describe('clearPendingRpe', () => {
    it('clears both main and aux RPE requests', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

      store.setPendingRpe(1);
      store.setPendingAuxRpe('leg-curl', 2);

      expect(store.pendingRpeSetNumber).toBe(1);
      expect(store.pendingAuxRpe).not.toBeNull();

      store.clearPendingRpe();

      expect(useSessionStore.getState().pendingRpeSetNumber).toBeNull();
      expect(useSessionStore.getState().pendingAuxRpe).toBeNull();
    });
  });
});

describe('sessionStore aux confirmation overlay', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  describe('setPendingAuxConfirmation', () => {
    it('sets confirmation data for first aux set', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

      store.setPendingAuxConfirmation({
        exerciseIndex: 0,
        exercise: 'leg-curl',
        setNumber: 1,
        setsInExercise: 3,
        weightGrams: 50_000,
        reps: 10,
      });

      const state = useSessionStore.getState().pendingAuxConfirmation;
      expect(state).toMatchObject({
        exercise: 'leg-curl',
        setNumber: 1,
        setsInExercise: 3,
        weightGrams: 50_000,
        reps: 10,
      });
    });
  });

  describe('clearPendingAuxConfirmation', () => {
    it('clears confirmation overlay', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

      store.setPendingAuxConfirmation({
        exerciseIndex: 0,
        exercise: 'leg-curl',
        setNumber: 1,
        setsInExercise: 3,
        weightGrams: 50_000,
        reps: 10,
      });

      store.clearPendingAuxConfirmation();

      expect(useSessionStore.getState().pendingAuxConfirmation).toBeNull();
    });
  });
});

describe('sessionStore superset state machine', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  describe('registerSupersetGroup', () => {
    it('registers a superset group on active timer', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [
        { weight_kg: 100, reps: 5 },
        { weight_kg: 105, reps: 5 },
      ]);
      store.openTimer({ durationSeconds: 180 });

      store.registerSupersetGroup({
        groupId: 'A',
        setNumbers: [0, 1],
        restBetweenSetsSeconds: 60,
        restAfterGroupSeconds: 180,
      });

      const sg = useSessionStore.getState().timerState?.supersetGroup;
      expect(sg).toMatchObject({
        groupId: 'A',
        setNumbers: [0, 1],
        currentIndex: 0,
        restBetweenSetsSeconds: 60,
        restAfterGroupSeconds: 180,
      });
    });

    it('is a no-op if no timer is active', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

      store.registerSupersetGroup({
        groupId: 'A',
        setNumbers: [0, 1],
        restBetweenSetsSeconds: 60,
        restAfterGroupSeconds: 180,
      });

      expect(useSessionStore.getState().timerState?.supersetGroup).toBeUndefined();
    });
  });

  describe('advanceSuperset', () => {
    it('increments currentIndex', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [
        { weight_kg: 100, reps: 5 },
        { weight_kg: 105, reps: 5 },
      ]);
      store.openTimer({ durationSeconds: 180 });
      store.registerSupersetGroup({
        groupId: 'A',
        setNumbers: [0, 1],
        restBetweenSetsSeconds: 60,
        restAfterGroupSeconds: 180,
      });

      expect(store.timerState?.supersetGroup?.currentIndex).toBe(0);

      store.advanceSuperset('A');

      expect(useSessionStore.getState().timerState?.supersetGroup?.currentIndex).toBe(1);
    });

    it('ignores advances for non-matching group ID', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
      store.openTimer({ durationSeconds: 180 });
      store.registerSupersetGroup({
        groupId: 'A',
        setNumbers: [0, 1],
        restBetweenSetsSeconds: 60,
        restAfterGroupSeconds: 180,
      });

      store.advanceSuperset('B');

      expect(useSessionStore.getState().timerState?.supersetGroup?.currentIndex).toBe(0);
    });
  });

  describe('clearSupersetGroup', () => {
    it('removes superset group from timer', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
      store.openTimer({ durationSeconds: 180 });
      store.registerSupersetGroup({
        groupId: 'A',
        setNumbers: [0, 1],
        restBetweenSetsSeconds: 60,
        restAfterGroupSeconds: 180,
      });

      expect(store.timerState?.supersetGroup).toBeDefined();

      store.clearSupersetGroup('A');

      expect(useSessionStore.getState().timerState?.supersetGroup).toBeUndefined();
    });
  });
});

describe('selectPostRestWeight', () => {
  it('returns null when no post-rest active', () => {
    const state: Pick<
      SessionState,
      'postRestState' | 'plannedSets' | 'actualSets' | 'currentAdaptation'
    > = {
      postRestState: null,
      plannedSets: [{ weight_kg: 100, reps: 5 }],
      actualSets: [],
      currentAdaptation: null,
    };

    const weight = selectPostRestWeight(state);
    expect(weight).toBeNull();
  });

  it('returns planned weight for aux post-rest', () => {
    const state: Pick<
      SessionState,
      'postRestState' | 'plannedSets' | 'actualSets' | 'currentAdaptation'
    > = {
      postRestState: {
        pendingMainSetNumber: null,
        pendingAuxExercise: 'leg-curl',
        pendingAuxSetNumber: 1,
        actualRestSeconds: 90,
        liftStartedAt: Date.now(),
        plannedReps: 8,
        plannedWeightKg: 55,
        nextSetNumber: null,
        resetSecondsRemaining: null,
      },
      plannedSets: [],
      actualSets: [],
      currentAdaptation: null,
    };

    const weight = selectPostRestWeight(state);
    expect(weight).toBe(55);
  });

  it('returns live weight from adaptation for main lift post-rest', () => {
    const state: Pick<
      SessionState,
      'postRestState' | 'plannedSets' | 'actualSets' | 'currentAdaptation'
    > = {
      postRestState: {
        pendingMainSetNumber: 1,
        pendingAuxExercise: null,
        pendingAuxSetNumber: null,
        actualRestSeconds: 180,
        liftStartedAt: Date.now(),
        plannedReps: 3,
        plannedWeightKg: null,
        nextSetNumber: 2,
        resetSecondsRemaining: null,
      },
      plannedSets: [
        { weight_kg: 100, reps: 5 },
        { weight_kg: 105, reps: 3 },
      ],
      actualSets: [],
      currentAdaptation: {
        sets: [
          { set_number: 1, weight_kg: 100, reps: 5 },
          { set_number: 2, weight_kg: 100, reps: 3 }, // Adapted down
        ],
        restBonusSeconds: 0,
        adaptationType: 'weight_reduced',
        rationale: 'user failed set 1',
      },
    };

    const weight = selectPostRestWeight(state);
    expect(weight).toBe(100); // Adapted weight, not original 105
  });
});

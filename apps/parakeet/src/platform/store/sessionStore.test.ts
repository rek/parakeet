import type { SessionState } from './sessionStore';
import { deriveTimerKey, useSessionStore } from './sessionStore';
import { selectPostRestWeight } from '../../modules/session/utils/selectPostRestWeight';

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

  it('merge migrates old timerState format to timers dict', () => {
    const opts = getPersistOptions(useSessionStore);
    const oldTimer = {
      visible: true,
      durationSeconds: 180,
      elapsed: 45,
      offset: 0,
      timerStartedAt: Date.now(),
      pendingMainSetNumber: 1,
      pendingAuxExercise: null,
      pendingAuxSetNumber: null,
    };
    const merged = opts.merge(
      { timerState: oldTimer },
      useSessionStore.getState()
    );
    expect(merged.timers).toHaveProperty('main');
    expect(merged.timers['main']).toEqual(oldTimer);
    expect(merged.activeTimerKey).toBe('main');
  });

  it('merge migrates old postRestState to postRestQueue', () => {
    const opts = getPersistOptions(useSessionStore);
    const oldPostRest = {
      pendingMainSetNumber: 1,
      pendingAuxExercise: null,
      pendingAuxSetNumber: null,
      actualRestSeconds: 180,
      liftStartedAt: Date.now(),
      plannedReps: 5,
      plannedWeightKg: null,
      nextSetNumber: 2,
      resetSecondsRemaining: null,
    };
    const merged = opts.merge(
      { postRestState: oldPostRest },
      useSessionStore.getState()
    );
    expect(merged.postRestQueue).toHaveLength(1);
    expect(merged.postRestQueue[0]).toEqual(oldPostRest);
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

      const state = useSessionStore.getState().postRestQueue[0] ?? null;
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
      const before = useSessionStore.getState().postRestQueue[0] ?? null;

      store.showMainPostRest(5, 180);

      expect(useSessionStore.getState().postRestQueue[0] ?? null).toEqual(before);
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

      const state = useSessionStore.getState().postRestQueue[0] ?? null;
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
      const before = useSessionStore.getState().postRestQueue[0] ?? null;

      store.showAuxPostRest('nonexistent', 1, 90);

      expect(useSessionStore.getState().postRestQueue[0] ?? null).toEqual(before);
    });
  });

  describe('extendPostRest', () => {
    it('adds 15 seconds and starts countdown', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
      store.showMainPostRest(0, 180);

      store.extendPostRest();

      const state = useSessionStore.getState().postRestQueue[0] ?? null;
      expect(state?.actualRestSeconds).toBe(195);
      expect(state?.resetSecondsRemaining).toBe(15);
    });

    it('is a no-op if no post-rest active', () => {
      const store = useSessionStore.getState();
      const before = useSessionStore.getState().postRestQueue[0] ?? null;

      store.extendPostRest();

      expect(useSessionStore.getState().postRestQueue[0] ?? null).toEqual(before);
    });
  });

  describe('tickPostRestCountdown', () => {
    it('decrements resetSecondsRemaining each tick', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
      store.showMainPostRest(0, 180);
      store.extendPostRest();

      expect(useSessionStore.getState().postRestQueue[0]?.resetSecondsRemaining).toBe(15);

      store.tickPostRestCountdown();
      expect(useSessionStore.getState().postRestQueue[0]?.resetSecondsRemaining).toBe(14);

      store.tickPostRestCountdown();
      expect(useSessionStore.getState().postRestQueue[0]?.resetSecondsRemaining).toBe(13);
    });

    it('clears countdown when reaching zero', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
      store.showMainPostRest(0, 180);
      store.extendPostRest(); // resetSecondsRemaining = 15

      for (let i = 0; i < 15; i++) {
        store.tickPostRestCountdown();
      }

      expect(useSessionStore.getState().postRestQueue[0]?.resetSecondsRemaining).toBe(null);
    });
  });

  describe('clearPostRestState', () => {
    it('shifts first item off the queue (FIFO)', () => {
      const store = useSessionStore.getState();
      store.initSession('s1', [
        { weight_kg: 100, reps: 5 },
        { weight_kg: 105, reps: 5 },
      ]);
      store.initAuxiliaryWork([
        {
          exercise: 'leg-curl',
          sets: [{ weight_kg: 50, reps: 10 }, { weight_kg: 55, reps: 8 }],
          skipped: false,
        },
      ]);
      store.showMainPostRest(0, 180);
      store.showAuxPostRest('leg-curl', 1, 90);

      expect(useSessionStore.getState().postRestQueue).toHaveLength(2);
      expect(useSessionStore.getState().postRestQueue[0]?.pendingMainSetNumber).toBe(0);

      store.clearPostRestState();

      expect(useSessionStore.getState().postRestQueue).toHaveLength(1);
      expect(useSessionStore.getState().postRestQueue[0]?.pendingAuxExercise).toBe('leg-curl');

      store.clearPostRestState();

      expect(useSessionStore.getState().postRestQueue).toHaveLength(0);
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

      expect(useSessionStore.getState().pendingRpeSetNumber).toBe(1);
      expect(useSessionStore.getState().pendingAuxRpe).not.toBeNull();

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

describe('selectPostRestWeight', () => {
  it('returns null when no post-rest active', () => {
    const weight = selectPostRestWeight({
      postRestState: null,
      plannedSets: [{ weight_kg: 100, reps: 5 }],
      actualSets: [],
      currentAdaptation: null,
    });
    expect(weight).toBeNull();
  });

  it('returns planned weight for aux post-rest', () => {
    const weight = selectPostRestWeight({
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
    });
    expect(weight).toBe(55);
  });

  it('returns live weight from adaptation for main lift post-rest', () => {
    const weight = selectPostRestWeight({
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
          { weight_kg: 100 },
          { weight_kg: 100 }, // Adapted down from 105
        ],
        adaptationType: 'weight_reduced',
      },
    });
    expect(weight).toBe(100); // Adapted weight, not original 105
  });

  it('updates when user manually adjusts next set weight during rest', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [
      { weight_kg: 100, reps: 5 },
      { weight_kg: 105, reps: 5 },
    ]);
    store.showMainPostRest(1, 180); // Showing post-rest for set index 1 (105kg, set_number=2)

    const getOpts = () => {
      const s = useSessionStore.getState();
      return {
        postRestState: s.postRestQueue[0] ?? null,
        plannedSets: s.plannedSets,
        actualSets: s.actualSets,
        currentAdaptation: s.currentAdaptation,
      };
    };

    // Post-rest overlay initially shows 105kg
    expect(selectPostRestWeight(getOpts())).toBe(105);

    // User manually bumps weight via SetRow button (issue #189/#190 regression test)
    // set_number is 1-indexed: set index 1 has set_number 2
    store.updateSet(2, { weight_grams: 110_000 });

    // Post-rest display should reflect new weight immediately (not show stale value)
    expect(selectPostRestWeight(getOpts())).toBe(110);
  });
});

describe('initSession adaptation state reset (gh#193 regression)', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('resets consecutiveMainLiftFailures to 0 on new session', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
    store.recordSetFailure();
    store.recordSetFailure();
    expect(useSessionStore.getState().consecutiveMainLiftFailures).toBe(2);

    store.initSession('s2', [{ weight_kg: 80, reps: 5 }]);
    expect(useSessionStore.getState().consecutiveMainLiftFailures).toBe(0);
  });

  it('resets currentAdaptation to null on new session', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
    store.setAdaptation({
      adaptationType: 'weight_reduced',
      sets: [{ set_number: 1, weight_kg: 95, reps: 5 }],
      restBonusSeconds: 0,
      rationale: 'test',
    });
    expect(useSessionStore.getState().currentAdaptation).not.toBeNull();

    store.initSession('s2', [{ weight_kg: 80, reps: 5 }]);
    expect(useSessionStore.getState().currentAdaptation).toBeNull();
  });

  it('resets auxAdaptations to empty object on new session', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
    store.setAuxAdaptation('leg-curl', {
      exercise: 'leg-curl',
      adaptationType: 'weight_reduced',
      sets: [{ set_number: 1, weight_kg: 40, reps: 10 }],
      rationale: 'test',
    });
    expect(Object.keys(useSessionStore.getState().auxAdaptations)).toHaveLength(1);

    store.initSession('s2', [{ weight_kg: 80, reps: 5 }]);
    expect(useSessionStore.getState().auxAdaptations).toEqual({});
  });
});

describe('concurrent timers', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    vi.restoreAllMocks();
  });

  it('openTimer for aux A then aux B: both timers exist', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

    store.openTimer({ durationSeconds: 90, pendingAuxExercise: 'leg-curl', pendingAuxSetNumber: 1 });
    store.openTimer({ durationSeconds: 60, pendingAuxExercise: 'rdl', pendingAuxSetNumber: 1 });

    const { timers } = useSessionStore.getState();
    expect(timers).toHaveProperty('leg-curl');
    expect(timers).toHaveProperty('rdl');
  });

  it('openTimer for same exercise replaces that timer', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

    store.openTimer({ durationSeconds: 90, pendingAuxExercise: 'leg-curl', pendingAuxSetNumber: 1 });
    store.openTimer({ durationSeconds: 60, pendingAuxExercise: 'leg-curl', pendingAuxSetNumber: 2 });

    const { timers } = useSessionStore.getState();
    const keys = Object.keys(timers);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe('leg-curl');
    expect(timers['leg-curl'].durationSeconds).toBe(60);
  });

  it('main timer always takes activeTimerKey precedence', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

    store.openTimer({ durationSeconds: 90, pendingAuxExercise: 'leg-curl', pendingAuxSetNumber: 1 });
    store.openTimer({ durationSeconds: 180, pendingMainSetNumber: 1 });

    const { activeTimerKey } = useSessionStore.getState();
    expect(activeTimerKey).toBe('main');
  });

  it('closeTimer removes active timer, promotes next', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

    store.openTimer({ durationSeconds: 90, pendingAuxExercise: 'leg-curl', pendingAuxSetNumber: 1 });
    store.openTimer({ durationSeconds: 60, pendingAuxExercise: 'rdl', pendingAuxSetNumber: 1 });

    const { activeTimerKey: initialActive } = useSessionStore.getState();
    store.closeTimer();

    const { timers, activeTimerKey } = useSessionStore.getState();
    expect(Object.keys(timers)).toHaveLength(1);
    expect(activeTimerKey).not.toBe(initialActive);
  });

  it('closeTimer with explicit key removes that timer without changing activeTimerKey when it is not active', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

    store.openTimer({ durationSeconds: 90, pendingAuxExercise: 'leg-curl', pendingAuxSetNumber: 1 });
    store.openTimer({ durationSeconds: 60, pendingAuxExercise: 'rdl', pendingAuxSetNumber: 1 });

    // Force active to leg-curl
    store.switchActiveTimer('leg-curl');

    // Close the background timer by key
    store.closeTimer('rdl');

    const { timers, activeTimerKey } = useSessionStore.getState();
    expect(timers).not.toHaveProperty('rdl');
    expect(activeTimerKey).toBe('leg-curl');
  });

  it('switchActiveTimer changes active key', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

    store.openTimer({ durationSeconds: 90, pendingAuxExercise: 'leg-curl', pendingAuxSetNumber: 1 });
    store.openTimer({ durationSeconds: 60, pendingAuxExercise: 'rdl', pendingAuxSetNumber: 1 });

    store.switchActiveTimer('leg-curl');
    expect(useSessionStore.getState().activeTimerKey).toBe('leg-curl');

    store.switchActiveTimer('rdl');
    expect(useSessionStore.getState().activeTimerKey).toBe('rdl');
  });

  it('switchActiveTimer is a no-op for unknown key', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);

    store.openTimer({ durationSeconds: 90, pendingAuxExercise: 'leg-curl', pendingAuxSetNumber: 1 });
    store.switchActiveTimer('nonexistent');

    expect(useSessionStore.getState().activeTimerKey).toBe('leg-curl');
  });

  it('completeExpiredTimers moves expired background timer to postRestQueue', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
    store.initAuxiliaryWork([
      {
        exercise: 'leg-curl',
        sets: [{ weight_kg: 50, reps: 10 }, { weight_kg: 55, reps: 8 }],
        skipped: false,
      },
    ]);

    // Open main timer (will be active) and an aux background timer
    store.openTimer({ durationSeconds: 180, pendingMainSetNumber: 1 });
    store.openTimer({ durationSeconds: 60, pendingAuxExercise: 'leg-curl', pendingAuxSetNumber: 1 });

    expect(useSessionStore.getState().activeTimerKey).toBe('main');

    // Advance time so the background aux timer's elapsed exceeds its duration
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 90_000); // +90s
    store.tickTimer();
    vi.restoreAllMocks();

    store.completeExpiredTimers();

    const state = useSessionStore.getState();
    // Aux timer removed; main timer stays
    expect(state.timers).toHaveProperty('main');
    expect(state.timers).not.toHaveProperty('leg-curl');
    // PostRestState pushed for the expired aux timer
    expect(state.postRestQueue).toHaveLength(1);
    expect(state.postRestQueue[0]).toMatchObject({
      pendingAuxExercise: 'leg-curl',
      pendingAuxSetNumber: 1,
      plannedReps: 8,
      plannedWeightKg: 55,
    });
  });

  it('completeExpiredTimers does not expire timers still running', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [{ weight_kg: 100, reps: 5 }]);
    store.initAuxiliaryWork([
      {
        exercise: 'leg-curl',
        sets: [{ weight_kg: 50, reps: 10 }],
        skipped: false,
      },
    ]);

    store.openTimer({ durationSeconds: 180, pendingMainSetNumber: 1 });
    store.openTimer({ durationSeconds: 120, pendingAuxExercise: 'leg-curl', pendingAuxSetNumber: 0 });

    // Only advance 30s — not enough to expire the 120s aux timer
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 30_000);
    store.tickTimer();
    vi.restoreAllMocks();

    store.completeExpiredTimers();

    const state = useSessionStore.getState();
    expect(state.timers).toHaveProperty('leg-curl');
    expect(state.postRestQueue).toHaveLength(0);
  });

  it('postRestQueue accumulates multiple entries', () => {
    const store = useSessionStore.getState();
    store.initSession('s1', [
      { weight_kg: 100, reps: 5 },
      { weight_kg: 105, reps: 5 },
    ]);
    store.initAuxiliaryWork([
      {
        exercise: 'leg-curl',
        sets: [{ weight_kg: 50, reps: 10 }],
        skipped: false,
      },
    ]);

    store.showMainPostRest(0, 180);
    store.showAuxPostRest('leg-curl', 0, 90);

    const { postRestQueue } = useSessionStore.getState();
    expect(postRestQueue).toHaveLength(2);
    expect(postRestQueue[0]?.pendingMainSetNumber).toBe(0);
    expect(postRestQueue[1]?.pendingAuxExercise).toBe('leg-curl');
  });

  it('deriveTimerKey returns main for main set, exercise name for aux, warmup otherwise', () => {
    expect(deriveTimerKey({ pendingMainSetNumber: 1 })).toBe('main');
    expect(deriveTimerKey({ pendingAuxExercise: 'leg-curl' })).toBe('leg-curl');
    expect(deriveTimerKey({})).toBe('warmup');
    expect(deriveTimerKey({ pendingMainSetNumber: null, pendingAuxExercise: null })).toBe('warmup');
  });
});

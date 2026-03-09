import type { SessionState } from './sessionStore';
import { useSessionStore } from './sessionStore';

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
    expect(merged.startedAt!.toISOString()).toBe(state.startedAt!.toISOString());
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

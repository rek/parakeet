vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

import { useSessionStore } from './sessionStore';

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
    const opts = (store as any).persist.getOptions();

    const partialized = opts.partialize(state);
    const serialized = JSON.parse(JSON.stringify(partialized));

    // After JSON round-trip, startedAt is a string
    expect(typeof serialized.startedAt).toBe('string');

    // merge should reconstruct it as a Date
    const merged = opts.merge(serialized, store.getState());
    expect(merged.startedAt).toBeInstanceOf(Date);
    expect(merged.startedAt.toISOString()).toBe(state.startedAt!.toISOString());
  });

  it('merge handles missing startedAt gracefully', () => {
    const opts = (useSessionStore as any).persist.getOptions();
    const merged = opts.merge({}, useSessionStore.getState());
    expect(merged.startedAt).toBeUndefined();
  });

  it('merge handles undefined persisted state', () => {
    const opts = (useSessionStore as any).persist.getOptions();
    const merged = opts.merge(undefined, useSessionStore.getState());
    expect(merged.startedAt).toBeUndefined();
  });

  it('merge always initializes warmupCompleted as empty Set', () => {
    const opts = (useSessionStore as any).persist.getOptions();
    const merged = opts.merge({ warmupCompleted: [1, 2, 3] }, useSessionStore.getState());
    expect(merged.warmupCompleted).toBeInstanceOf(Set);
    expect(merged.warmupCompleted.size).toBe(0);
  });
});

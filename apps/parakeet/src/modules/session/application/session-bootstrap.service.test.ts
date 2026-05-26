import { describe, expect, it, vi } from 'vitest';

import {
  decideBootstrap,
  recoverAdHocExercises,
  type BootstrapStoreSnapshot,
} from './session-bootstrap.service';

// vi.mock calls are hoisted by vitest, so their lexical position below the
// imports does not affect runtime behaviour. session.service depends on a tree
// that imports react-native; only the pure decideBootstrap and
// recoverAdHocExercises are under test here.
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@sentry/react-native', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('./session.service', () => ({
  getSession: vi.fn(),
  startSession: vi.fn(),
}));

vi.mock('./set-persistence.service', () => ({
  flushUnsyncedSets: vi.fn().mockResolvedValue(undefined),
}));

const emptyStore: BootstrapStoreSnapshot = {
  sessionId: null,
  cachedJitData: null,
  firstActualSetWeightGrams: undefined,
};

describe('decideBootstrap', () => {
  it('returns abort_back missing_session_id when sessionId is absent', () => {
    const { action } = decideBootstrap(
      {
        sessionId: undefined,
        jitDataParam: null,
        isFreeForm: false,
        userId: 'u',
      },
      emptyStore
    );
    expect(action).toEqual({ kind: 'abort_back', reason: 'missing_session_id' });
  });

  it('detects parse_error on malformed JIT JSON', () => {
    const { action } = decideBootstrap(
      {
        sessionId: 's1',
        jitDataParam: '{not-json',
        isFreeForm: false,
        userId: 'u',
      },
      emptyStore
    );
    expect(action).toEqual({ kind: 'abort_back', reason: 'parse_error' });
  });

  it('returns missing_jit when no route param and store has no cached JIT for this session', () => {
    const { action } = decideBootstrap(
      {
        sessionId: 's1',
        jitDataParam: null,
        isFreeForm: false,
        userId: 'u',
      },
      emptyStore
    );
    expect(action).toEqual({ kind: 'abort_back', reason: 'missing_jit' });
  });

  it('returns free_form_init when current store session differs from sessionId', () => {
    const { action } = decideBootstrap(
      {
        sessionId: 's1',
        jitDataParam: null,
        isFreeForm: true,
        userId: 'u',
      },
      emptyStore
    );
    expect(action.kind).toBe('free_form_init');
  });

  it('returns free_form_resume when current store session matches sessionId', () => {
    const { action } = decideBootstrap(
      {
        sessionId: 's1',
        jitDataParam: null,
        isFreeForm: true,
        userId: 'u',
      },
      { ...emptyStore, sessionId: 's1' }
    );
    expect(action.kind).toBe('free_form_resume');
  });

  it('returns session_init for a new session with JIT param', () => {
    const jit = JSON.stringify({
      mainLiftSets: [{ weight_kg: 100, reps: 5 }],
      warmupSets: [],
      auxiliaryWork: [],
    });
    const { action, parsed } = decideBootstrap(
      {
        sessionId: 's2',
        jitDataParam: jit,
        isFreeForm: false,
        userId: 'u',
      },
      emptyStore
    );
    expect(action.kind).toBe('session_init');
    expect(parsed?.mainLiftSets[0].weight_kg).toBe(100);
  });

  it('returns jit_changed when weight differs from store actualSets', () => {
    const jit = JSON.stringify({
      mainLiftSets: [{ weight_kg: 120, reps: 5 }],
      warmupSets: [],
      auxiliaryWork: [],
    });
    const { action } = decideBootstrap(
      {
        sessionId: 's3',
        jitDataParam: jit,
        isFreeForm: false,
        userId: 'u',
      },
      {
        sessionId: 's3',
        cachedJitData: null,
        firstActualSetWeightGrams: 100_000,
      }
    );
    expect(action.kind).toBe('jit_changed');
  });

  it('returns resume when sessionId and weights match the store', () => {
    const jit = JSON.stringify({
      mainLiftSets: [{ weight_kg: 100, reps: 5 }],
      warmupSets: [],
      auxiliaryWork: [],
    });
    const { action } = decideBootstrap(
      {
        sessionId: 's4',
        jitDataParam: jit,
        isFreeForm: false,
        userId: 'u',
      },
      {
        sessionId: 's4',
        cachedJitData: null,
        firstActualSetWeightGrams: 100_000,
      }
    );
    expect(action.kind).toBe('resume');
  });

  it('falls back to store cachedJitData when route param missing and store sessionId matches', () => {
    const jit = JSON.stringify({
      mainLiftSets: [{ weight_kg: 110, reps: 5 }],
      warmupSets: [],
      auxiliaryWork: [],
    });
    const { action } = decideBootstrap(
      {
        sessionId: 's5',
        jitDataParam: null,
        isFreeForm: false,
        userId: 'u',
      },
      {
        sessionId: 's5',
        cachedJitData: jit,
        firstActualSetWeightGrams: 110_000,
      }
    );
    expect(action.kind).toBe('resume');
  });
});

describe('recoverAdHocExercises', () => {
  it('filters out template-tagged sets', () => {
    const result = recoverAdHocExercises({
      auxiliarySets: [
        { exercise: 'bike', template_instance_id: 'a' },
        { exercise: 'curl' },
      ],
    });
    expect(result).toEqual(['curl']);
  });

  it('filters out prescribed aux exercises', () => {
    const result = recoverAdHocExercises({
      auxiliarySets: [
        { exercise: 'curl' },
        { exercise: 'tricep_pushdown' },
      ],
      prescribedAuxExercises: ['curl'],
    });
    expect(result).toEqual(['tricep_pushdown']);
  });

  it('dedupes repeated exercise entries', () => {
    const result = recoverAdHocExercises({
      auxiliarySets: [
        { exercise: 'curl' },
        { exercise: 'curl' },
        { exercise: 'row' },
      ],
    });
    expect(result).toEqual(['curl', 'row']);
  });
});

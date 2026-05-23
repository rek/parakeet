// @spec docs/features/session/spec-logging.md
import { useSessionStore } from '../store/sessionStore';
import { flushUnsyncedSets } from './set-persistence.service';
import type { JitData, WarmupSet } from '../model/types';
import { getSession } from './session.service';
import { startSession } from './session.service';

export type BootstrapAction =
  | { kind: 'session_init'; sessionId: string; parsed: JitData }
  | { kind: 'jit_changed'; sessionId: string; parsed: JitData }
  | { kind: 'resume'; sessionId: string; parsed: JitData }
  | { kind: 'free_form_init'; sessionId: string }
  | { kind: 'free_form_resume'; sessionId: string }
  | { kind: 'redirect_soreness'; sessionId: string }
  | { kind: 'abort_back'; reason: 'missing_session_id' | 'missing_jit' | 'parse_error' | 'session_not_found' };

export interface BootstrapInput {
  sessionId: string | undefined | null;
  jitDataParam: string | undefined | null;
  isFreeForm: boolean;
  userId: string | undefined;
}

/**
 * Minimal store snapshot the bootstrap decision needs. Injected by the hook
 * so `decideBootstrap` stays a pure function — no hidden global dependency,
 * unit-testable without store mutation in setup.
 */
export interface BootstrapStoreSnapshot {
  sessionId: string | null;
  cachedJitData: string | null;
  firstActualSetWeightGrams: number | undefined;
}

export function snapshotStoreForBootstrap(): BootstrapStoreSnapshot {
  const state = useSessionStore.getState();
  return {
    sessionId: state.sessionId,
    cachedJitData: state.cachedJitData,
    firstActualSetWeightGrams: state.actualSets[0]?.weight_grams,
  };
}

export interface BootstrapResult {
  /** Side-effect-free decision so the hook can render correct error UX. */
  action: BootstrapAction;
  /** Parsed JIT data when applicable, otherwise null. */
  parsed: JitData | null;
  /** Warmup sets pulled from parsed (empty when not applicable). */
  warmupSets: WarmupSet[];
  /** Ad-hoc exercise names recovered from the persisted store (resume paths). */
  adHocExercises: string[];
}

/**
 * Pure decision logic — given route inputs and current store state, decide
 * which bootstrap branch applies. The hook layer applies the side effects.
 *
 * Returning a decision keeps the hook small and testable, and prevents the
 * old race condition where parse failure quietly popped back without a Sentry
 * breadcrumb or user-visible alert (GH#issue tracked in solution doc).
 */
export function decideBootstrap(
  input: BootstrapInput,
  store: BootstrapStoreSnapshot
): {
  action: BootstrapAction;
  parsed: JitData | null;
} {
  const { sessionId, jitDataParam, isFreeForm } = input;

  if (!sessionId) {
    return {
      action: { kind: 'abort_back', reason: 'missing_session_id' },
      parsed: null,
    };
  }

  const currentStoreSessionId = store.sessionId;

  if (isFreeForm) {
    if (currentStoreSessionId !== sessionId) {
      return {
        action: { kind: 'free_form_init', sessionId },
        parsed: null,
      };
    }
    return {
      action: { kind: 'free_form_resume', sessionId },
      parsed: null,
    };
  }

  // For non-freeform: fall back to store-cached jit when nav arrived without route param.
  const effectiveJitData =
    jitDataParam ??
    (currentStoreSessionId === sessionId ? store.cachedJitData : null);

  if (!effectiveJitData) {
    return { action: { kind: 'abort_back', reason: 'missing_jit' }, parsed: null };
  }

  let parsed: JitData;
  try {
    parsed = JSON.parse(effectiveJitData) as JitData;
  } catch {
    return { action: { kind: 'abort_back', reason: 'parse_error' }, parsed: null };
  }

  const { mainLiftSets } = parsed;
  const storeWeight = store.firstActualSetWeightGrams;
  const jitWeight = mainLiftSets[0]
    ? Math.round(mainLiftSets[0].weight_kg * 1000)
    : undefined;
  const jitDataChanged =
    currentStoreSessionId === sessionId &&
    jitWeight !== undefined &&
    storeWeight !== jitWeight;

  if (currentStoreSessionId !== sessionId) {
    return { action: { kind: 'session_init', sessionId, parsed }, parsed };
  }
  if (jitDataChanged) {
    return { action: { kind: 'jit_changed', sessionId, parsed }, parsed };
  }
  return { action: { kind: 'resume', sessionId, parsed }, parsed };
}

/**
 * Recover ad-hoc exercises from the persisted store. Filters out template-tagged
 * sets (they render via AuxTemplateBlock) and, on resume from a JIT-driven session,
 * also filters out exercises that already appear in the auxiliary work prescription.
 */
export function recoverAdHocExercises(opts: {
  auxiliarySets: { exercise: string; template_instance_id?: string }[];
  prescribedAuxExercises?: string[];
}) {
  const prescribed = new Set(opts.prescribedAuxExercises ?? []);
  return [
    ...new Set(
      opts.auxiliarySets
        .filter(
          (s) =>
            s.template_instance_id == null && !prescribed.has(s.exercise)
        )
        .map((s) => s.exercise)
    ),
  ];
}

interface ApplyOpts {
  invalidateSessionCache: () => void;
  oneRmKgRef: { current: number | undefined };
  restRecommendationsRef: { current: JitData['restRecommendations'] | null };
  llmRestSuggestionRef: { current: JitData['llmRestSuggestion'] | null };
}

/**
 * Apply the decided bootstrap action: flush prior unsynced sets, init store,
 * fetch/stamp session meta, restore aux exercises, and start the session row.
 *
 * Returns the warmup sets and ad-hoc exercise list the screen needs to render.
 *
 * Errors are surfaced to the caller — the hook owns alerting + navigation.
 */
export async function applyBootstrap(
  action: BootstrapAction,
  input: BootstrapInput,
  opts: ApplyOpts
): Promise<{
  warmupSets: WarmupSet[];
  adHocExercises: string[];
  /** Set when the in-progress session lacks planned_sets and JIT cache is gone. */
  needsSorenessRedirect: boolean;
}> {
  const store = useSessionStore.getState();
  const { userId } = input;

  switch (action.kind) {
    case 'free_form_init': {
      if (store.sessionId && store.sessionId !== action.sessionId && userId) {
        await flushUnsyncedSets(userId);
      }
      store.initSession(action.sessionId, []);
      const session = await getSession(action.sessionId);
      if (!session) {
        // Surface to caller — they alert + back.
        throw new BootstrapError('session_not_found');
      }
      store.setSessionMeta({
        primary_lift: session.primary_lift,
        intensity_type: session.intensity_type,
        block_number: session.block_number ?? null,
        week_number: session.week_number,
        activity_name: session.activity_name,
      });
      opts.invalidateSessionCache();
      return { warmupSets: [], adHocExercises: [], needsSorenessRedirect: false };
    }

    case 'free_form_resume': {
      const adHoc = recoverAdHocExercises({
        auxiliarySets: store.auxiliarySets,
      });
      return { warmupSets: [], adHocExercises: adHoc, needsSorenessRedirect: false };
    }

    case 'session_init':
    case 'jit_changed': {
      const parsed = action.parsed;
      const { mainLiftSets, warmupSets, auxiliaryWork } = parsed;
      const aux = auxiliaryWork ?? [];

      store.setCachedJitData(JSON.stringify(parsed));
      if (parsed.restRecommendations) {
        opts.restRecommendationsRef.current = parsed.restRecommendations;
      }
      if (parsed.llmRestSuggestion) {
        opts.llmRestSuggestionRef.current = parsed.llmRestSuggestion;
      }
      if (parsed.oneRmKg != null) {
        opts.oneRmKgRef.current = parsed.oneRmKg;
      }

      if (
        store.sessionId &&
        store.sessionId !== action.sessionId &&
        userId
      ) {
        await flushUnsyncedSets(userId);
      }
      store.initSession(action.sessionId, mainLiftSets);
      store.initAuxiliaryWork(aux);

      const activeAux = aux.filter((a) => !a.skipped);
      if (activeAux.length > 0) {
        store.initAuxiliary(
          activeAux.map((a) => ({
            exercise: a.exercise,
            sets: a.sets,
            exerciseType: a.exerciseType,
          }))
        );
      }

      const session = await getSession(action.sessionId);
      if (!session) throw new BootstrapError('session_not_found');
      store.setSessionMeta({
        primary_lift: session.primary_lift,
        intensity_type: session.intensity_type,
        block_number: session.block_number ?? null,
        week_number: session.week_number,
      });
      await startSession(action.sessionId);
      opts.invalidateSessionCache();
      return {
        warmupSets: warmupSets ?? [],
        adHocExercises: [],
        needsSorenessRedirect: false,
      };
    }

    case 'resume': {
      const parsed = action.parsed;
      const aux = parsed.auxiliaryWork ?? [];
      store.setCachedJitData(JSON.stringify(parsed));
      if (parsed.restRecommendations) {
        opts.restRecommendationsRef.current = parsed.restRecommendations;
      }
      if (parsed.llmRestSuggestion) {
        opts.llmRestSuggestionRef.current = parsed.llmRestSuggestion;
      }
      if (parsed.oneRmKg != null) {
        opts.oneRmKgRef.current = parsed.oneRmKg;
      }
      store.initAuxiliaryWork(aux);
      const adHoc = recoverAdHocExercises({
        auxiliarySets: store.auxiliarySets,
        prescribedAuxExercises: aux.map((a) => a.exercise),
      });
      return {
        warmupSets: parsed.warmupSets ?? [],
        adHocExercises: adHoc,
        needsSorenessRedirect: false,
      };
    }

    case 'redirect_soreness':
    case 'abort_back':
      return { warmupSets: [], adHocExercises: [], needsSorenessRedirect: false };
  }
}

/**
 * Recovery path: when the route requested resume of an `in_progress` session
 * but planned_sets is NULL and no JIT cache is available, the bootstrap can't
 * proceed and the user should be sent to the soreness/JIT flow rather than
 * silently popped back.
 *
 * Returns true if the route should redirect to the soreness flow (keeping the
 * `in_progress` status untouched).
 */
export async function shouldRedirectToSoreness(opts: {
  sessionId: string | null | undefined;
}): Promise<boolean> {
  if (!opts.sessionId) return false;
  try {
    const session = await getSession(opts.sessionId);
    if (!session) return false;
    if (session.status !== 'in_progress') return false;
    if (session.planned_sets != null) return false;
    return true;
  } catch {
    return false;
  }
}

export class BootstrapError extends Error {
  constructor(public reason: 'session_not_found') {
    super(reason);
    this.name = 'BootstrapError';
  }
}

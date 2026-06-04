import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { captureException } from '@platform/utils/captureException';
import { router } from 'expo-router';

import type { JitData, WarmupSet } from '../model/types';
import {
  applyBootstrap,
  BootstrapError,
  decideBootstrap,
  shouldRedirectToSoreness,
  snapshotStoreForBootstrap,
} from '../application/session-bootstrap.service';

interface UseSessionBootstrapInput {
  sessionId: string | undefined | null;
  jitDataParam: string | undefined | null;
  isFreeForm: boolean;
  userId: string | undefined;
  invalidateSessionCache: () => void;
  oneRmKgRef: { current: number | undefined };
  restRecommendationsRef: { current: JitData['restRecommendations'] | null };
  llmRestSuggestionRef: { current: JitData['llmRestSuggestion'] | null };
}

/**
 * One-shot bootstrap for the session-log route. Owns the orchestration that
 * used to live inline in `app/(tabs)/session/[sessionId].tsx`:
 *   • parse JIT JSON from route param (or fall back to store cache)
 *   • flush unsynced sets from prior session before overwriting the store
 *   • init store / restore aux work / restore ad-hoc exercises
 *   • fetch session meta + call startSession
 *   • on parse failure: capture + alert + navigate back
 *   • on missing JIT for in-progress session: redirect to soreness flow
 *
 * Returns `{ bootstrapped, warmupSets, adHocExercises }`. The screen renders
 * an `ActivityIndicator` until `bootstrapped` flips true so users never see a
 * blank session UI mid-init.
 */
export function useSessionBootstrap(input: UseSessionBootstrapInput) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [warmupSets, setWarmupSets] = useState<WarmupSet[]>([]);
  const [adHocExercises, setAdHocExercises] = useState<string[]>([]);

  // Guard against React 18 double-mount in dev. The bootstrap is one-shot.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      const { action } = decideBootstrap(
        {
          sessionId: input.sessionId,
          jitDataParam: input.jitDataParam,
          isFreeForm: input.isFreeForm,
          userId: input.userId,
        },
        snapshotStoreForBootstrap()
      );

      if (action.kind === 'abort_back') {
        if (action.reason === 'parse_error') {
          captureException(
            new Error('Session bootstrap: JIT JSON parse failed')
          );
          Alert.alert(
            'Session data corrupted',
            'We could not load this session. Please try again.'
          );
          router.back();
          setBootstrapped(true);
          return;
        }

        if (action.reason === 'missing_jit') {
          // Recovery path: if the session is in_progress but has no
          // planned_sets and no cached JIT, send the user back into the
          // soreness/JIT flow rather than popping them off the screen.
          // decideBootstrap already established the store cache also missed
          // (otherwise this branch wouldn't fire), so we only redirect when
          // the session itself genuinely needs re-prescription. Breadcrumb so
          // a soreness-flow exit that leaves planned_sets null doesn't loop
          // silently.
          const redirect = await shouldRedirectToSoreness({
            sessionId: input.sessionId,
          });
          if (redirect && input.sessionId) {
            captureException(
              new Error(
                `Session bootstrap redirecting to soreness for recovery — sessionId=${input.sessionId}`
              )
            );
            router.replace({
              pathname: '/session/soreness',
              params: { sessionId: input.sessionId },
            });
            setBootstrapped(true);
            return;
          }
          router.back();
          setBootstrapped(true);
          return;
        }

        // missing_session_id
        router.back();
        setBootstrapped(true);
        return;
      }

      try {
        const result = await applyBootstrap(action, input, {
          invalidateSessionCache: input.invalidateSessionCache,
          oneRmKgRef: input.oneRmKgRef,
          restRecommendationsRef: input.restRecommendationsRef,
          llmRestSuggestionRef: input.llmRestSuggestionRef,
        });
        setWarmupSets(result.warmupSets);
        setAdHocExercises(result.adHocExercises);
      } catch (err) {
        if (err instanceof BootstrapError) {
          // session_not_found — surface to user.
          captureException(err);
          Alert.alert('Session not found', 'This workout no longer exists.');
          router.back();
        } else {
          captureException(err);
        }
      } finally {
        setBootstrapped(true);
      }
    })();
    // Intentional empty deps — bootstrap runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // setWarmupSets is exposed so the "revert to formula" flow can swap the
  // displayed warmup (regenerated from the formula working weight) in place,
  // without remounting the screen.
  return {
    bootstrapped,
    warmupSets,
    adHocExercises,
    setAdHocExercises,
    setWarmupSets,
  };
}

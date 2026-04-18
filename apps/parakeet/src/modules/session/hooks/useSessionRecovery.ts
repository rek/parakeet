// Pathological-path recovery. useSetPersistence + flushUnsyncedSets cover the
// 99% case (local sets will re-sync on next mount). This hook surfaces the
// rare case where the server has already marked the session skipped/missed
// while the local store still holds confirmed sets — mostly a legacy-data
// safety net for users who were on a pre-durability build when the reconciler
// fired. See docs/features/session/spec-auto-finalize.md.

import { useEffect, useRef } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';

import { useSessionStore } from '@platform/store/sessionStore';
import { captureException } from '@platform/utils/captureException';
import * as Sentry from '@sentry/react-native';

import { recoverSkippedSessionFromLocal } from '../application/session.service';
import { fetchSessionById } from '../data/session.repository';

type Decision = 'pending' | 'prompted' | 'resolved';

export function useSessionRecovery(userId: string | undefined) {
  // Track per-sessionId state so a single foreground event can't re-fire the
  // alert while the previous one is still on screen, and a user's Save /
  // Discard decision isn't re-prompted until the session changes.
  const decisionsRef = useRef<Map<string, Decision>>(new Map());

  useEffect(() => {
    if (!userId) return;
    void detectAndRecover(userId, decisionsRef.current);
    const sub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          void detectAndRecover(userId, decisionsRef.current);
        }
      }
    );
    return () => {
      sub.remove();
    };
  }, [userId]);
}

async function detectAndRecover(
  userId: string,
  decisions: Map<string, Decision>
): Promise<void> {
  try {
    const state = useSessionStore.getState();
    const sessionId = state.sessionId;
    if (!sessionId) return;

    const hasUnsynced =
      state.actualSets.some((s) => s.is_completed && !s.synced_at)
      || state.auxiliarySets.some((s) => s.is_completed && !s.synced_at);
    if (!hasUnsynced) return;

    // Alert is already on screen or the user has already chosen for this
    // sessionId — don't re-prompt on re-foreground.
    const prior = decisions.get(sessionId);
    if (prior === 'prompted' || prior === 'resolved') return;

    const session = await fetchSessionById(sessionId);
    if (!session) return;

    // Normal paths — useSetPersistence's flush covers these.
    if (session.status === 'in_progress' || session.status === 'planned') {
      return;
    }

    // Server considers the session finished. Local is stale; drop it quietly.
    if (session.status === 'completed') {
      Sentry.addBreadcrumb({
        category: 'session.durability',
        message: 'clearing stale local store — server session already completed',
        level: 'info',
        data: { sessionId },
      });
      state.reset();
      decisions.set(sessionId, 'resolved');
      return;
    }

    // Pathological: local has real work, server skipped/missed. Post-fix this
    // should never happen — if it does we want to know.
    if (session.status === 'skipped' || session.status === 'missed') {
      decisions.set(sessionId, 'prompted');
      Sentry.captureException(
        new Error(
          `Session recovery: local store holds unsynced completed sets for ${session.status} session`
        ),
        { tags: { feature: 'session-durability', sessionId } }
      );
      promptRecovery(sessionId, userId, decisions);
    }
  } catch (err) {
    captureException(err);
  }
}

function promptRecovery(
  sessionId: string,
  userId: string,
  decisions: Map<string, Decision>
): void {
  Alert.alert(
    'Unsaved workout found',
    "You logged a workout that wasn't saved — likely from a previous build. Save it now, or discard?",
    [
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          Sentry.addBreadcrumb({
            category: 'session.durability',
            message: 'user discarded unsynced local session',
            level: 'info',
            data: { sessionId },
          });
          useSessionStore.getState().reset();
          decisions.set(sessionId, 'resolved');
        },
      },
      {
        text: 'Save',
        onPress: () => {
          recoverSkippedSessionFromLocal(sessionId, userId)
            .then(() => {
              useSessionStore.getState().reset();
              decisions.set(sessionId, 'resolved');
            })
            .catch((err) => {
              // Leave the decision as 'prompted' so user can retry after
              // investigating; alternatively reset so they get the prompt
              // again on next foreground. Retrying is safer than silent drop.
              decisions.delete(sessionId);
              captureException(err);
            });
        },
      },
    ],
    { cancelable: false }
  );
}

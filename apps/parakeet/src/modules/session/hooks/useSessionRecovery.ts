// Pathological-path recovery. useSetPersistence + flushUnsyncedSets cover the
// 99% case (local sets will re-sync on next mount). This hook surfaces the
// rare case where the server has already marked the session skipped/missed
// while the local store still holds confirmed sets — mostly a legacy-data
// safety net for users who were on a pre-durability build when the reconciler
// fired. See docs/features/session/spec-auto-finalize.md.

import { useEffect } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';

import { useSessionStore } from '@platform/store/sessionStore';
import { captureException } from '@platform/utils/captureException';
import * as Sentry from '@sentry/react-native';

import { recoverSkippedSessionFromLocal } from '../application/session.service';
import { fetchSessionById } from '../data/session.repository';

export function useSessionRecovery(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    void detectAndRecover(userId);
    const sub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') void detectAndRecover(userId);
      }
    );
    return () => {
      sub.remove();
    };
  }, [userId]);
}

async function detectAndRecover(userId: string): Promise<void> {
  try {
    const state = useSessionStore.getState();
    const sessionId = state.sessionId;
    if (!sessionId) return;

    const hasUnsynced =
      state.actualSets.some((s) => s.is_completed && !s.synced_at)
      || state.auxiliarySets.some((s) => s.is_completed && !s.synced_at);
    if (!hasUnsynced) return;

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
      return;
    }

    // Pathological: local has real work, server skipped/missed. Post-fix this
    // should never happen — if it does we want to know.
    if (session.status === 'skipped' || session.status === 'missed') {
      Sentry.captureException(
        new Error(
          `Session recovery: local store holds unsynced completed sets for ${session.status} session`
        ),
        { tags: { feature: 'session-durability', sessionId } }
      );
      promptRecovery(sessionId, userId);
    }
  } catch (err) {
    captureException(err);
  }
}

function promptRecovery(sessionId: string, userId: string): void {
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
        },
      },
      {
        text: 'Save',
        onPress: () => {
          recoverSkippedSessionFromLocal(sessionId, userId)
            .then(() => {
              useSessionStore.getState().reset();
            })
            .catch(captureException);
        },
      },
    ],
    { cancelable: false }
  );
}

// @spec docs/features/session/spec-set-persistence.md
// Subscribes to sessionStore and fires persistSet whenever a set transitions
// to completed or has its values edited. Complements the legacy completeSession
// batch write so each confirmed set is durable from the moment of confirmation.

import { useEffect, useRef } from 'react';

import type {
  ActualSet,
  AuxiliaryActualSet,
  SessionState,
} from '@platform/store/sessionStore';
import { useSessionStore } from '@platform/store/sessionStore';

import {
  flushUnsyncedSets,
  persistSet,
} from '../application/set-persistence.service';

// Fields whose changes warrant a re-sync. synced_at itself is excluded so
// markSetSynced() doesn't retrigger us.
function primaryFingerprint(s: ActualSet): string {
  return [
    s.is_completed ? 1 : 0,
    s.weight_grams,
    s.reps_completed,
    s.rpe_actual ?? '',
    s.actual_rest_seconds ?? '',
    s.failed ? 1 : 0,
  ].join('|');
}

function auxFingerprint(s: AuxiliaryActualSet): string {
  return [
    s.is_completed ? 1 : 0,
    s.weight_grams,
    s.reps_completed,
    s.rpe_actual ?? '',
    s.actual_rest_seconds ?? '',
    s.failed ? 1 : 0,
  ].join('|');
}

export function useSetPersistence(userId: string | undefined) {
  const prevPrimaryRef = useRef<Map<number, string>>(new Map());
  const prevAuxRef = useRef<Map<string, string>>(new Map());
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    // Seed the fingerprint maps with the current snapshot so the subscriber
    // doesn't re-fire for already-known sets. flushUnsyncedSets handles any
    // that were confirmed before this hook mounted.
    const initial = useSessionStore.getState();
    prevPrimaryRef.current = new Map(
      initial.actualSets.map((s) => [s.set_number, primaryFingerprint(s)])
    );
    prevAuxRef.current = new Map(
      initial.auxiliarySets.map((s) => [auxKey(s), auxFingerprint(s)])
    );
    mountedRef.current = true;

    // Recover any completed-but-unsynced sets from before this mount.
    void flushUnsyncedSets(userId);

    const unsubscribe = useSessionStore.subscribe((state) =>
      handleChange(state, userId)
    );

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
    // Intentionally re-create the subscription when the user changes. initSession
    // etc. are not reactive deps — we read them from store.getState() on each event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function handleChange(state: SessionState, userId: string): void {
    if (!mountedRef.current) return;
    const sessionId = state.sessionId;
    if (!sessionId) return;

    const nextPrimary = new Map<number, string>();
    for (const s of state.actualSets) {
      const fp = primaryFingerprint(s);
      nextPrimary.set(s.set_number, fp);
      if (!s.is_completed) continue;
      const prev = prevPrimaryRef.current.get(s.set_number);
      if (prev === fp && s.synced_at) continue;
      void persistSet({
        sessionId,
        userId,
        kind: 'primary',
        exercise: null,
        setNumber: s.set_number,
        weightGrams: s.weight_grams,
        repsCompleted: s.reps_completed,
        rpeActual: s.rpe_actual ?? null,
        actualRestSeconds: s.actual_rest_seconds ?? null,
        exerciseType: null,
        failed: s.failed ?? false,
      });
    }
    prevPrimaryRef.current = nextPrimary;

    const nextAux = new Map<string, string>();
    for (const s of state.auxiliarySets) {
      const key = auxKey(s);
      const fp = auxFingerprint(s);
      nextAux.set(key, fp);
      if (!s.is_completed) continue;
      const prev = prevAuxRef.current.get(key);
      if (prev === fp && s.synced_at) continue;
      void persistSet({
        sessionId,
        userId,
        kind: 'auxiliary',
        exercise: s.exercise,
        setNumber: s.set_number,
        weightGrams: s.weight_grams,
        repsCompleted: s.reps_completed,
        rpeActual: s.rpe_actual ?? null,
        actualRestSeconds: s.actual_rest_seconds ?? null,
        exerciseType: s.exercise_type ?? null,
        failed: s.failed ?? false,
      });
    }
    prevAuxRef.current = nextAux;
  }
}

function auxKey(s: AuxiliaryActualSet): string {
  return `${s.exercise}|${s.set_number}`;
}

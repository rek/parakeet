import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface CompleteSessionPayload {
  sessionId: string;
  userId: string;
  actualSets: {
    set_number: number;
    weight_grams: number;
    reps_completed: number;
    is_completed: boolean;
    rpe_actual?: number;
    actual_rest_seconds?: number;
    notes?: string;
  }[];
  auxiliarySets?: {
    exercise: string;
    set_number: number;
    weight_grams: number;
    reps_completed: number;
    is_completed: boolean;
    rpe_actual?: number;
    actual_rest_seconds?: number;
  }[];
  sessionRpe?: number;
  startedAt?: string;
}

export interface UpsertSetLogPayload {
  sessionId: string;
  userId: string;
  kind: 'primary' | 'auxiliary';
  exercise: string | null;
  setNumber: number;
  weightGrams: number;
  repsCompleted: number;
  rpeActual?: number | null;
  actualRestSeconds?: number | null;
  exerciseType?: string | null;
  failed?: boolean;
  notes?: string | null;
  loggedAt: string;
}

export type PendingOperation =
  | {
      id: string;
      operation: 'complete_session' | 'skip_session';
      payload: CompleteSessionPayload;
      createdAt: string;
      retryCount: number;
    }
  | {
      id: string;
      operation: 'upsert_set_log';
      payload: UpsertSetLogPayload;
      createdAt: string;
      retryCount: number;
    };

type EnqueueArg =
  | { operation: 'complete_session' | 'skip_session'; payload: CompleteSessionPayload }
  | { operation: 'upsert_set_log'; payload: UpsertSetLogPayload };

interface SyncState {
  queue: PendingOperation[];
  enqueue: (op: EnqueueArg) => void;
  dequeue: (id: string) => void;
  incrementRetry: (id: string) => void;
}

function setLogDedupeKey(p: UpsertSetLogPayload): string {
  return `${p.sessionId}|${p.kind}|${p.exercise ?? ''}|${p.setNumber}`;
}

function isSetLogOp(
  op: PendingOperation
): op is Extract<PendingOperation, { operation: 'upsert_set_log' }> {
  return op.operation === 'upsert_set_log';
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      queue: [],

      enqueue: (op) =>
        set((state) => {
          // Per-set ops dedupe on slot key: latest write for a given
          // (session, kind, exercise, set_number) replaces any prior queued op.
          if (op.operation === 'upsert_set_log') {
            const key = setLogDedupeKey(op.payload);
            const filtered = state.queue.filter(
              (existing) =>
                !(isSetLogOp(existing) && setLogDedupeKey(existing.payload) === key)
            );
            return {
              queue: [
                ...filtered,
                {
                  ...op,
                  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  createdAt: new Date().toISOString(),
                  retryCount: 0,
                },
              ],
            };
          }
          return {
            queue: [
              ...state.queue,
              {
                ...op,
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                createdAt: new Date().toISOString(),
                retryCount: 0,
              },
            ],
          };
        }),

      dequeue: (id) =>
        set((state) => ({
          queue: state.queue.filter((op) => op.id !== id),
        })),

      incrementRetry: (id) =>
        set((state) => ({
          queue: state.queue.map((op) =>
            op.id === id ? { ...op, retryCount: op.retryCount + 1 } : op
          ),
        })),
    }),
    {
      name: 'parakeet-sync-queue',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

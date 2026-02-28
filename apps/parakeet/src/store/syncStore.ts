import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompleteSessionPayload {
  sessionId: string
  userId: string
  actualSets: {
    set_number: number
    weight_grams: number
    reps_completed: number
    rpe_actual?: number
    actual_rest_seconds?: number
    notes?: string
  }[]
  auxiliarySets?: {
    exercise: string
    set_number: number
    weight_grams: number
    reps_completed: number
    rpe_actual?: number
    actual_rest_seconds?: number
  }[]
  sessionRpe?: number
  startedAt?: string  // ISO string
}

export interface PendingOperation {
  id: string
  operation: 'complete_session' | 'skip_session'
  payload: CompleteSessionPayload
  createdAt: string
  retryCount: number
}

// ── Store ────────────────────────────────────────────────────────────────────

interface SyncState {
  queue: PendingOperation[]
  enqueue: (op: Pick<PendingOperation, 'operation' | 'payload'>) => void
  dequeue: (id: string) => void
  incrementRetry: (id: string) => void
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      queue: [],

      enqueue: (op) => set((state) => ({
        queue: [
          ...state.queue,
          {
            ...op,
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            createdAt: new Date().toISOString(),
            retryCount: 0,
          },
        ],
      })),

      dequeue: (id) => set((state) => ({
        queue: state.queue.filter((op) => op.id !== id),
      })),

      incrementRetry: (id) => set((state) => ({
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
)

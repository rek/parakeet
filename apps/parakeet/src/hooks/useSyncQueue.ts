import { useEffect, useRef } from 'react'
import { Alert } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'

import { useNetworkStatus } from './useNetworkStatus'
import { useSyncStore } from '../store/syncStore'
import { completeSession } from '../lib/sessions'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RETRIES = 5

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    msg.includes('network request failed') ||
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('timeout')
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Mount once at app root. Drains the sync queue whenever connectivity is
 * restored. Non-retryable failures surface an alert and drop the op.
 */
export function useSyncQueue() {
  const { isOnline } = useNetworkStatus()
  const { queue, dequeue, incrementRetry } = useSyncStore()
  const queryClient = useQueryClient()
  const processingRef = useRef(false)

  useEffect(() => {
    if (!isOnline || queue.length === 0 || processingRef.current) return
    drainQueue()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, queue.length])

  async function drainQueue() {
    if (processingRef.current) return
    processingRef.current = true

    try {
      for (const op of queue) {
        if (op.retryCount >= MAX_RETRIES) {
          dequeue(op.id)
          continue
        }

        try {
          if (op.operation === 'complete_session') {
            const { sessionId, userId, actualSets, auxiliarySets, sessionRpe, startedAt } =
              op.payload

            await completeSession(sessionId, userId, {
              actualSets,
              auxiliarySets,
              sessionRpe,
              startedAt: startedAt ? new Date(startedAt) : undefined,
            })

            dequeue(op.id)

            await queryClient.invalidateQueries({ queryKey: ['session'] })
            await queryClient.invalidateQueries({ queryKey: ['sessions', 'completed'] })
            await queryClient.invalidateQueries({ queryKey: ['performance', 'trends'] })
            await queryClient.invalidateQueries({ queryKey: ['achievements'] })
          }
        } catch (err) {
          if (isNetworkError(err)) {
            incrementRetry(op.id)
          } else {
            dequeue(op.id)
            Alert.alert(
              'Sync Failed',
              `Workout could not be saved: ${err instanceof Error ? err.message : 'Unknown error'}`,
            )
          }
        }
      }
    } finally {
      processingRef.current = false
    }
  }
}

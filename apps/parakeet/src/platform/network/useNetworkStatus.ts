import { useState, useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_MS     = 8_000  // check interval while app is active
const TIMEOUT_MS  = 3_000  // per-request timeout

// Lightweight connectivity probe — returns 204, no content served
const CHECK_URL = 'https://clients3.google.com/generate_204'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(CHECK_URL, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    return res.ok || res.status === 204
  } catch {
    return false
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startPolling() {
    if (intervalRef.current) return
    intervalRef.current = setInterval(async () => {
      setIsOnline(await checkConnectivity())
    }, POLL_MS)
  }

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => {
    checkConnectivity().then(setIsOnline)
    startPolling()

    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'active') {
        setIsOnline(await checkConnectivity())
        startPolling()
      } else {
        stopPolling()
      }
    })

    return () => {
      stopPolling()
      sub.remove()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isOnline, isOffline: !isOnline }
}

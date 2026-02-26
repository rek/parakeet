import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

// ── Types ────────────────────────────────────────────────────────────────────

export interface RestTimerProps {
  durationSeconds: number
  llmSuggestion?: {
    deltaSeconds: number
    formulaBaseSeconds: number
  }
  onDone: (elapsedSeconds: number) => void
  intensityLabel: string
  isAuxiliary?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMMSS(totalSeconds: number): string {
  const absSeconds = Math.abs(Math.floor(totalSeconds))
  const m = Math.floor(absSeconds / 60)
  const s = absSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Custom hook: ticking elapsed counter ──────────────────────────────────────
// `elapsed` always increases by 1 each second. `remaining` is derived from it
// plus any ephemeral adjustment offset, so both stay reactive.

function useRestTimer(durationSeconds: number) {
  const [elapsed, setElapsed] = useState(0)
  // Ephemeral offset: +30 / −30 button presses accumulate here
  const [offset, setOffset] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [])

  function stop() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Effective duration accounts for user adjustments
  const effectiveDuration = Math.max(0, durationSeconds + offset)
  const remaining = Math.max(0, effectiveDuration - elapsed)
  const overtime = elapsed > effectiveDuration

  function addOffset(delta: number) {
    setOffset((prev) => {
      const next = prev + delta
      // Never let effective duration go below 0
      return Math.max(-durationSeconds, next)
    })
  }

  return { elapsed, remaining, overtime, stop, addOffset }
}

// ── Pill variant (auxiliary sets) ─────────────────────────────────────────────

function AuxiliaryPill({
  durationSeconds,
  onDone,
}: {
  durationSeconds: number
  onDone: (elapsedSeconds: number) => void
}) {
  const { elapsed, remaining, overtime, stop } = useRestTimer(durationSeconds)

  function handleDone() {
    stop()
    onDone(elapsed)
  }

  const displayText = overtime
    ? `+${formatMMSS(elapsed - durationSeconds)}`
    : formatMMSS(remaining)

  return (
    <View style={pillStyles.container}>
      <Text style={[pillStyles.time, overtime && pillStyles.timeOvertime]}>
        {displayText}
      </Text>
      <TouchableOpacity
        style={pillStyles.doneButton}
        onPress={handleDone}
        activeOpacity={0.7}
      >
        <Text style={pillStyles.doneText}>Done</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Full timer (main sets) ────────────────────────────────────────────────────

function FullTimer({
  durationSeconds,
  llmSuggestion,
  onDone,
  intensityLabel,
}: Omit<RestTimerProps, 'isAuxiliary'>) {
  const { elapsed, remaining, overtime, stop, addOffset } =
    useRestTimer(durationSeconds)

  function handleDone() {
    stop()
    onDone(elapsed)
  }

  const showAiChip =
    llmSuggestion !== undefined &&
    Math.abs(llmSuggestion.deltaSeconds) >= 30

  const aiSuggestedSeconds =
    llmSuggestion !== undefined
      ? llmSuggestion.formulaBaseSeconds + llmSuggestion.deltaSeconds
      : 0

  const displayText = overtime
    ? `+${formatMMSS(elapsed - durationSeconds)}`
    : formatMMSS(remaining)

  return (
    <View style={fullStyles.container}>
      {/* Drag handle */}
      <View style={fullStyles.handle} />

      {/* Intensity label */}
      <Text style={fullStyles.intensityLabel}>{intensityLabel}</Text>

      {/* Countdown */}
      <Text style={[fullStyles.countdown, overtime && fullStyles.countdownOvertime]}>
        {displayText}
      </Text>

      {/* AI suggestion chip */}
      {showAiChip && (
        <View style={fullStyles.aiChip}>
          <Text style={fullStyles.aiChipText}>
            AI: {formatMMSS(aiSuggestedSeconds)} suggested
          </Text>
        </View>
      )}

      {/* Controls */}
      <View style={fullStyles.controlRow}>
        <TouchableOpacity
          style={fullStyles.adjustButton}
          onPress={() => addOffset(-30)}
          activeOpacity={0.7}
        >
          <Text style={fullStyles.adjustButtonText}>−30s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={fullStyles.doneButton}
          onPress={handleDone}
          activeOpacity={0.8}
        >
          <Text style={fullStyles.doneButtonText}>Done resting</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={fullStyles.adjustButton}
          onPress={() => addOffset(30)}
          activeOpacity={0.7}
        >
          <Text style={fullStyles.adjustButtonText}>+30s</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Public export ─────────────────────────────────────────────────────────────

export function RestTimer({
  durationSeconds,
  llmSuggestion,
  onDone,
  intensityLabel,
  isAuxiliary = false,
}: RestTimerProps) {
  if (isAuxiliary) {
    return (
      <AuxiliaryPill durationSeconds={durationSeconds} onDone={onDone} />
    )
  }

  return (
    <FullTimer
      durationSeconds={durationSeconds}
      llmSuggestion={llmSuggestion}
      onDone={onDone}
      intensityLabel={intensityLabel}
    />
  )
}

// ── Styles: pill ──────────────────────────────────────────────────────────────

const pillStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 6,
    gap: 10,
  },
  time: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  timeOvertime: {
    color: '#DC2626',
  },
  doneButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  doneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
})

// ── Styles: full ──────────────────────────────────────────────────────────────

const fullStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 20,
  },
  intensityLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 16,
  },
  countdown: {
    fontSize: 64,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -2,
    marginBottom: 16,
    fontVariant: ['tabular-nums'],
  },
  countdownOvertime: {
    color: '#DC2626',
  },
  aiChip: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  aiChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4338CA',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  adjustButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adjustButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  doneButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})

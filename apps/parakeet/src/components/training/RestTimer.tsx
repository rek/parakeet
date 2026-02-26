import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, spacing, radii, typography } from '../../theme'

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

// ── Custom hook ───────────────────────────────────────────────────────────────

function useRestTimer(durationSeconds: number) {
  const [elapsed, setElapsed] = useState(0)
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

  const effectiveDuration = Math.max(0, durationSeconds + offset)
  const remaining = Math.max(0, effectiveDuration - elapsed)
  const overtime = elapsed > effectiveDuration

  function addOffset(delta: number) {
    setOffset((prev) => {
      const next = prev + delta
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
      <View style={fullStyles.handle} />

      <Text style={fullStyles.intensityLabel}>{intensityLabel}</Text>

      <Text style={[fullStyles.countdown, overtime && fullStyles.countdownOvertime]}>
        {displayText}
      </Text>

      {showAiChip && (
        <View style={fullStyles.aiChip}>
          <Text style={fullStyles.aiChipText}>
            AI: {formatMMSS(aiSuggestedSeconds)} suggested
          </Text>
        </View>
      )}

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
    backgroundColor: colors.bgMuted,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[3],
    marginTop: spacing[1.5],
    gap: spacing[2.5],
  },
  time: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  timeOvertime: {
    color: colors.danger,
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2.5],
  },
  doneText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
})

// ── Styles: full ──────────────────────────────────────────────────────────────

const fullStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[10],
    paddingTop: spacing[3],
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginBottom: spacing[5],
  },
  intensityLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing[4],
  },
  countdown: {
    fontSize: 72,
    fontWeight: typography.weights.black,
    color: colors.text,
    letterSpacing: -3,
    marginBottom: spacing[4],
    fontVariant: ['tabular-nums'],
  },
  countdownOvertime: {
    color: colors.danger,
  },
  aiChip: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[3.5],
    marginBottom: spacing[6],
  },
  aiChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  adjustButton: {
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  adjustButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  doneButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing[3.5],
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
    letterSpacing: typography.letterSpacing.wide,
  },
})

import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { getRestTimerPrefs } from '../../modules/settings';
import { formatMMSS } from '../../shared/utils';
import { radii, spacing, typography } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

function playDing() {
  try {
    // Play 3 dings with short gaps so the alert is noticeable
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const player = createAudioPlayer(
            require('../../../assets/sounds/pickupCoin.wav')
          );
          player.play();
          setTimeout(() => player.remove(), 3000);
        } catch {
          // audio unavailable
        }
      }, i * 400);
    }
  } catch {
    // audio unavailable
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface RestTimerProps {
  durationSeconds: number;
  elapsed: number;
  offset: number;
  onAdjust: (deltaSecs: number) => void;
  llmSuggestion?: {
    deltaSeconds: number;
    formulaBaseSeconds: number;
  };
  onDone: (elapsedSeconds: number) => void;
  intensityLabel: string;
  isAuxiliary?: boolean;
}

// ── Internal hook (used only by AuxiliaryPill) ────────────────────────────────

function useRestTimer(durationSeconds: number) {
  const [elapsed, setElapsed] = useState(0);
  const [offset, setOffset] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  function stop() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  const effectiveDuration = Math.max(0, durationSeconds + offset);
  const remaining = Math.max(0, effectiveDuration - elapsed);
  const overtime = elapsed > effectiveDuration;

  function addOffset(delta: number) {
    setOffset((prev) => {
      const next = prev + delta;
      return Math.max(-durationSeconds, next);
    });
  }

  return { elapsed, remaining, overtime, stop, addOffset };
}

// ── Pill variant (auxiliary sets, inline use) ─────────────────────────────────

function AuxiliaryPill({
  durationSeconds,
  onDone,
}: {
  durationSeconds: number;
  onDone: (elapsedSeconds: number) => void;
}) {
  const { colors } = useTheme();
  const { elapsed, remaining, overtime, stop } = useRestTimer(durationSeconds);

  const pillStyles = useMemo(() => StyleSheet.create({
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
  }), [colors]);

  function handleDone() {
    stop();
    onDone(elapsed);
  }

  const displayText = overtime
    ? `+${formatMMSS(elapsed - durationSeconds)}`
    : formatMMSS(remaining);

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
  );
}

// ── Full timer (main sets) ────────────────────────────────────────────────────

function FullTimer({
  durationSeconds,
  elapsed,
  offset,
  onAdjust,
  llmSuggestion,
  onDone,
  intensityLabel,
}: Omit<RestTimerProps, 'isAuxiliary'>) {
  const { colors } = useTheme();
  const effectiveDuration = Math.max(0, durationSeconds + offset);
  const remaining = Math.max(0, effectiveDuration - elapsed);
  const overtime = elapsed > effectiveDuration;

  const fullStyles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.bgElevated,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing[5],
      paddingBottom: spacing[5],
      paddingTop: spacing[4],
      alignItems: 'center',
      width: '100%',
      maxWidth: 560,
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
  }), [colors]);

  const prevOvertimeRef = useRef(false);
  const audioAlertRef = useRef(true);
  const hapticAlertRef = useRef(true);
  useEffect(() => {
    getRestTimerPrefs().then((p) => {
      audioAlertRef.current = p.audioAlert;
      hapticAlertRef.current = p.hapticAlert;
    });
  }, []);
  useEffect(() => {
    prevOvertimeRef.current = false;
  }, [durationSeconds, offset]);
  useEffect(() => {
    if (overtime && !prevOvertimeRef.current) {
      if (hapticAlertRef.current)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      if (audioAlertRef.current) playDing();
    }
    prevOvertimeRef.current = overtime;
  }, [overtime]);

  const showAiChip =
    llmSuggestion !== undefined && Math.abs(llmSuggestion.deltaSeconds) >= 30;

  const aiSuggestedSeconds =
    llmSuggestion !== undefined
      ? llmSuggestion.formulaBaseSeconds + llmSuggestion.deltaSeconds
      : 0;

  const displayText = overtime
    ? `+${formatMMSS(elapsed - effectiveDuration)}`
    : formatMMSS(remaining);

  return (
    <View style={fullStyles.container}>
      <Text style={fullStyles.intensityLabel}>{intensityLabel}</Text>

      <Text
        style={[fullStyles.countdown, overtime && fullStyles.countdownOvertime]}
      >
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
          onPress={() => onAdjust(-30)}
          activeOpacity={0.7}
        >
          <Text style={fullStyles.adjustButtonText}>−30s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={fullStyles.doneButton}
          onPress={() => onDone(elapsed)}
          activeOpacity={0.8}
        >
          <Text style={fullStyles.doneButtonText}>Done resting</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={fullStyles.adjustButton}
          onPress={() => onAdjust(30)}
          activeOpacity={0.7}
        >
          <Text style={fullStyles.adjustButtonText}>+30s</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function RestTimer({
  durationSeconds,
  elapsed,
  offset,
  onAdjust,
  llmSuggestion,
  onDone,
  intensityLabel,
  isAuxiliary = false,
}: RestTimerProps) {
  if (isAuxiliary) {
    return <AuxiliaryPill durationSeconds={durationSeconds} onDone={onDone} />;
  }

  return (
    <FullTimer
      durationSeconds={durationSeconds}
      elapsed={elapsed}
      offset={offset}
      onAdjust={onAdjust}
      llmSuggestion={llmSuggestion}
      onDone={onDone}
      intensityLabel={intensityLabel}
    />
  );
}

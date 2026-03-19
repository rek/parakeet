import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { PrescriptionTrace } from '@parakeet/training-engine';

import { Sheet } from '../../../components/ui/Sheet';
import { spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { capitalize } from '@shared/utils/string';
import {
  formatAuxTrace,
  formatRestTrace,
  formatVolumeChanges,
  formatWeightDerivation,
} from '../utils/format-trace';
import type { TraceLine } from '../utils/format-trace';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  trace: PrescriptionTrace;
  focusExercise?: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    scroll: {
      flexGrow: 1,
      flexShrink: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      gap: spacing[4],
    },
    strategyBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[0.5],
      borderRadius: 4,
      backgroundColor: colors.primaryMuted,
    },
    strategyBadgeText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    noAdjustments: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    section: {
      gap: spacing[2],
    },
    sectionHeader: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.textTertiary,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    bulletRow: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    bulletMark: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    bulletText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    warningBox: {
      padding: spacing[3],
      borderRadius: 8,
      backgroundColor: colors.warningMuted,
      borderWidth: 1,
      borderColor: colors.warning,
      gap: spacing[1],
    },
    warningText: {
      fontSize: typography.sizes.sm,
      color: colors.warning,
    },
    traceLineBlock: {
      gap: spacing[0.5],
    },
    derivationLine: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      fontFamily: typography.families.mono,
    },
    derivationFinal: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      fontWeight: typography.weights.semibold,
      fontFamily: typography.families.mono,
    },
    subtitle: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      paddingLeft: spacing[1],
    },
    auxBlock: {
      gap: spacing[1],
    },
    auxName: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    auxNameFocused: {
      color: colors.primary,
    },
    auxLine: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      paddingLeft: spacing[2],
    },
    auxSubtitle: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      paddingLeft: spacing[2],
    },
    restLine: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    restLineFinal: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      fontWeight: typography.weights.semibold,
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STRATEGY_LABELS: Record<PrescriptionTrace['strategy'], string> = {
  formula: 'Formula',
  llm: 'LLM',
  hybrid: 'Hybrid',
  formula_fallback: 'Fallback',
};

function renderTraceLine(
  line: TraceLine,
  textStyle: object,
  subtitleStyle: object,
  key: number | string,
) {
  if (!line.subtitle) {
    return <Text key={key} style={textStyle}>{line.text}</Text>;
  }
  return (
    <View key={key} style={{ gap: 2 }}>
      <Text style={textStyle}>{line.text}</Text>
      <Text style={subtitleStyle}>{line.subtitle}</Text>
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PrescriptionSheet({ visible, onClose, trace, focusExercise }: Props) {
  const { colors } = useTheme();

  const styles = useMemo(() => buildStyles(colors), [colors]);

  const strategyLabel = STRATEGY_LABELS[trace.strategy] ?? trace.strategy;
  const contextLabel = `${capitalize(trace.primaryLift)} · ${capitalize(trace.intensityType)} · Block ${trace.blockNumber}`;

  const weightLines = trace.mainLift.weightDerivation
    ? formatWeightDerivation({ derivation: trace.mainLift.weightDerivation })
    : null;

  const volumeLines = formatVolumeChanges({ changes: trace.mainLift.volumeChanges });

  const restLines = formatRestTrace({ rest: trace.rest });

  const hasAdjustments = trace.rationale.length > 0 || volumeLines.length > 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Workout Reasoning"
      subtitle={contextLabel}
      position="top"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Strategy badge */}
        <View style={styles.strategyBadge}>
          <Text style={styles.strategyBadgeText}>{strategyLabel}</Text>
        </View>

        {/* Rationale */}
        {trace.rationale.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Rationale</Text>
            {trace.rationale.map((line, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletMark}>•</Text>
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Warnings */}
        {trace.warnings.length > 0 && (
          <View style={styles.warningBox}>
            {trace.warnings.map((w, i) => (
              <Text key={i} style={styles.warningText}>
                {w}
              </Text>
            ))}
          </View>
        )}

        {/* Weight Derivation */}
        {weightLines !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Weight Derivation</Text>
            {weightLines.map((line, i) =>
              renderTraceLine(
                line,
                i === weightLines.length - 1
                  ? styles.derivationFinal
                  : styles.derivationLine,
                styles.subtitle,
                i,
              )
            )}
          </View>
        )}

        {/* Volume Adjustments */}
        {volumeLines.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Volume Adjustments</Text>
            {volumeLines.map((line, i) => (
              <View key={i}>
                <View style={styles.bulletRow}>
                  <Text style={styles.bulletMark}>•</Text>
                  <Text style={styles.bulletText}>{line.text}</Text>
                </View>
                {line.subtitle && (
                  <Text style={[styles.subtitle, { paddingLeft: spacing[4] }]}>
                    {line.subtitle}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* No adjustments hint */}
        {!hasAdjustments && (
          <Text style={styles.noAdjustments}>
            No adjustments — standard prescription
          </Text>
        )}

        {/* Auxiliary Exercises */}
        {trace.auxiliaries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Auxiliary Exercises</Text>
            {trace.auxiliaries.map((aux, i) => {
              const isFocused =
                focusExercise !== undefined && aux.exercise === focusExercise;
              const auxLines = formatAuxTrace({ aux });
              return (
                <View key={i} style={styles.auxBlock}>
                  <Text style={[styles.auxName, isFocused && styles.auxNameFocused]}>
                    {capitalize(aux.exercise.replace(/_/g, ' '))}
                  </Text>
                  {auxLines.map((line, j) => (
                    <View key={j}>
                      <Text style={styles.auxLine}>{line.text}</Text>
                      {line.subtitle && (
                        <Text style={styles.auxSubtitle}>{line.subtitle}</Text>
                      )}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Rest */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Rest</Text>
          {restLines.map((line, i) =>
            renderTraceLine(
              line,
              line.text.startsWith('Final:')
                ? styles.restLineFinal
                : styles.restLine,
              styles.subtitle,
              i,
            )
          )}
        </View>
      </ScrollView>
    </Sheet>
  );
}

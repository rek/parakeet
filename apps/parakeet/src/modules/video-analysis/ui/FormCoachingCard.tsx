import { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { FormCoachingResult } from '@parakeet/shared-types';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';

function gradeColor(
  grade: 'good' | 'acceptable' | 'needs_work',
  colors: ColorScheme
) {
  if (grade === 'good') return colors.info;
  if (grade === 'acceptable') return colors.warning;
  return colors.danger;
}

const GRADE_LABELS = {
  good: 'Good',
  acceptable: 'Acceptable',
  needs_work: 'Needs Work',
} as const;

function priorityColor(
  priority: 'high' | 'medium' | 'low',
  colors: ColorScheme
) {
  if (priority === 'high') return colors.danger;
  if (priority === 'medium') return colors.warning;
  return colors.info;
}

/**
 * Displays LLM-generated form coaching results.
 *
 * Shows summary, rep-by-rep assessment, coaching cues with priorities,
 * fatigue correlation, baseline comparison, and next-session suggestion.
 * Self-contained — handles loading, empty, and populated states.
 */
export function FormCoachingCard({
  coaching,
  isGenerating,
  error,
  onGenerate,
  colors,
}: {
  coaching: FormCoachingResult | null;
  isGenerating: boolean;
  error: string | null;
  onGenerate: () => void;
  colors: ColorScheme;
}) {
  const styles = useMemo(() => buildStyles(colors), [colors]);

  // No coaching yet — show generate button
  if (!coaching && !isGenerating) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>AI Coaching</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity
          style={styles.generateButton}
          onPress={onGenerate}
          activeOpacity={0.75}
          accessible
          accessibilityLabel="Generate AI form coaching"
          accessibilityRole="button"
        >
          <Text style={styles.generateButtonText}>Analyze My Form</Text>
          <Text style={styles.generateHint}>
            AI reviews your reps, correlates with training data, and gives
            specific coaching cues
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Generating
  if (isGenerating) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>AI Coaching</Text>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Analyzing your form...</Text>
        </View>
      </View>
    );
  }

  if (!coaching) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>AI Coaching</Text>

      {/* Summary */}
      <Text style={styles.summaryText}>{coaching.summary}</Text>

      {/* Rep-by-rep breakdown */}
      {coaching.repByRepBreakdown.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.subsectionLabel}>Rep Breakdown</Text>
          {coaching.repByRepBreakdown.map((rep) => (
            <View key={rep.repNumber} style={styles.repRow}>
              <View style={styles.repHeader}>
                <Text style={styles.repLabel}>Rep {rep.repNumber}</Text>
                <View
                  style={[
                    styles.gradeBadge,
                    {
                      backgroundColor: gradeColor(rep.formGrade, colors) + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.gradeText,
                      { color: gradeColor(rep.formGrade, colors) },
                    ]}
                  >
                    {GRADE_LABELS[rep.formGrade]}
                  </Text>
                </View>
              </View>
              <Text style={styles.repAssessment}>{rep.assessment}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Coaching cues */}
      {coaching.cues.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.subsectionLabel}>Coaching Cues</Text>
          {coaching.cues.map((cue, i) => (
            <View key={i} style={styles.cueRow}>
              <View
                style={[
                  styles.priorityDot,
                  { backgroundColor: priorityColor(cue.priority, colors) },
                ]}
              />
              <View style={styles.cueContent}>
                <Text style={styles.cueObservation}>{cue.observation}</Text>
                <Text style={styles.cueText}>{cue.cue}</Text>
                {cue.repRange !== 'all' && (
                  <Text style={styles.cueRepRange}>Reps: {cue.repRange}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Fatigue correlation */}
      {coaching.fatigueCorrelation && (
        <View style={styles.section}>
          <Text style={styles.subsectionLabel}>Fatigue Correlation</Text>
          <Text style={styles.insightText}>{coaching.fatigueCorrelation}</Text>
        </View>
      )}

      {/* Baseline comparison */}
      {coaching.comparedToBaseline && (
        <View style={styles.section}>
          <Text style={styles.subsectionLabel}>vs. Your Baseline</Text>
          <Text style={styles.insightText}>{coaching.comparedToBaseline}</Text>
        </View>
      )}

      {/* Competition readiness */}
      {coaching.competitionReadiness && (
        <View style={styles.section}>
          <Text style={styles.subsectionLabel}>Competition Readiness</Text>
          <Text style={styles.insightText}>
            {Math.round(coaching.competitionReadiness.passRate * 100)}% pass
            rate — {coaching.competitionReadiness.assessment}
          </Text>
          {coaching.competitionReadiness.topConcern && (
            <Text
              style={[
                styles.insightText,
                { color: colors.danger, marginTop: 4 },
              ]}
            >
              Top concern: {coaching.competitionReadiness.topConcern}
            </Text>
          )}
        </View>
      )}

      {/* Next session suggestion */}
      <View style={[styles.section, styles.suggestionSection]}>
        <Text style={styles.subsectionLabel}>Next Session</Text>
        <Text style={styles.suggestionText}>
          {coaching.nextSessionSuggestion}
        </Text>
      </View>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
      marginBottom: spacing[3],
    },
    sectionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.widest,
      marginBottom: spacing[3],
    },
    errorText: {
      fontSize: typography.sizes.sm,
      color: colors.danger,
      marginBottom: spacing[2],
    },
    generateButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radii.md,
      borderStyle: 'dashed',
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[4],
      alignItems: 'center',
      gap: spacing[1],
    },
    generateButtonText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    generateHint: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      textAlign: 'center',
      lineHeight: 16,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    loadingText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    summaryText: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      lineHeight: 20,
      marginBottom: spacing[3],
    },
    section: {
      marginTop: spacing[2],
      paddingTop: spacing[2],
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    subsectionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.textTertiary,
      marginBottom: spacing[2],
    },
    repRow: {
      marginBottom: spacing[2],
    },
    repHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing[1],
    },
    repLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },
    gradeBadge: {
      paddingHorizontal: spacing[2],
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    gradeText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
    },
    repAssessment: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      lineHeight: 18,
    },
    cueRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
      marginBottom: spacing[2],
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: radii.full,
      marginTop: 4,
      flexShrink: 0,
    },
    cueContent: {
      flex: 1,
    },
    cueObservation: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    cueText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.text,
      lineHeight: 18,
    },
    cueRepRange: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      marginTop: 2,
    },
    insightText: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      lineHeight: 20,
    },
    suggestionSection: {
      backgroundColor: colors.bgMuted,
      marginHorizontal: -spacing[4],
      marginBottom: -spacing[4],
      marginTop: spacing[3],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomLeftRadius: radii.md,
      borderBottomRightRadius: radii.md,
      borderTopWidth: 0,
    },
    suggestionText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.text,
      lineHeight: 20,
    },
  });
}

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@modules/auth';
import { useCycleReview } from '@modules/cycle-review';
import {
  createFormulaOverride,
  deactivateFormulaConfig,
} from '@modules/formula';
import type { FormulaConfig } from '@modules/formula';
import { getRatingStyles, getVolumeLevelColors } from '@modules/history';
import { classifyVolumeLevel } from '@modules/training-volume';
import type { MuscleGroup } from '@parakeet/shared-types';
import {
  MUSCLE_GROUPS_ORDER,
  MUSCLE_LABELS_ABBR,
} from '@shared/constants/training';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../../components/navigation/BackLink';
import { ScreenTitle } from '../../../components/ui/ScreenTitle';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type ProgressRating = 'excellent' | 'good' | 'stalled' | 'concerning';

interface LiftProgress {
  rating: ProgressRating;
  oneRmStart: number;
  oneRmEnd: number;
  narrative: string;
}

interface AuxInsight {
  exercise: string;
  lift: string;
  explanation: string;
}

interface FormulaSuggestion {
  id: string;
  description: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  overrides: Partial<FormulaConfig>;
}

interface StructuralSuggestion {
  description: string;
  developerNote?: string;
}

interface CycleReviewData {
  overallAssessment?: string;
  progressByLift?: Partial<Record<string, LiftProgress>>;
  auxiliaryInsights?: {
    mostCorrelated?: AuxInsight[];
    leastEffective?: AuxInsight[];
    recommendedChanges?: string[];
  };
  weeklyVolume?: Record<string, Record<MuscleGroup, number>>;
  formulaSuggestions?: FormulaSuggestion[];
  nextCycleRecommendations?: string;
  structuralSuggestions?: StructuralSuggestion[];
  meta?: {
    completedSessions?: number;
    totalSessions?: number;
    cycleStart?: string;
    cycleEnd?: string;
    wilksStart?: number;
    wilksEnd?: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MUSCLES = MUSCLE_GROUPS_ORDER;

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bgSurface },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.bgMuted,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    loadingTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    loadingSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    retryButton: {
      marginTop: 16,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    generateButton: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    generateButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    retryButtonText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: '700',
    },

    scroll: { flex: 1 },
    content: { padding: 16, gap: 16, paddingBottom: 48 },

    // Summary card
    summaryCard: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 16,
      padding: 16,
      gap: 8,
    },
    summaryMeta: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
    summaryMetaText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
    overallAssessment: { fontSize: 15, color: colors.text, lineHeight: 22 },

    // Sections
    section: { gap: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },

    // Lift cards
    liftCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      gap: 4,
    },
    liftCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    liftName: { fontSize: 16, fontWeight: '700', color: colors.text },
    ratingBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    ratingText: { fontSize: 12, fontWeight: '600' },
    liftDelta: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
    liftNarrative: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    // Auxiliary
    auxSubtitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    auxItem: { paddingLeft: 8, gap: 2 },
    auxExercise: { fontSize: 14, fontWeight: '600', color: colors.text },
    auxExplanation: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    auxChange: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

    // Heatmap
    heatmapRow: { flexDirection: 'row', alignItems: 'center' },
    heatmapWeekCell: { width: 32, alignItems: 'center' },
    heatmapWeek: { fontSize: 10, color: colors.textSecondary },
    heatmapCell: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.bgMuted,
    },
    heatmapHeader: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    heatmapValue: { fontSize: 10, color: colors.textSecondary },

    // Formula suggestions
    suggestionCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      gap: 8,
    },
    suggestionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    suggestionDescription: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    priorityBadge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    priorityText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    suggestionRationale: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    suggestionActions: { flexDirection: 'row', gap: 10 },
    acceptButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    acceptButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textInverse,
    },
    dismissButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    dismissButtonText: { fontSize: 14, color: colors.textSecondary },

    // Next cycle
    nextCycleCard: {
      backgroundColor: colors.successMuted,
      borderRadius: 16,
      padding: 16,
      gap: 10,
    },
    nextCycleTitle: { fontSize: 16, fontWeight: '700', color: colors.success },
    nextCycleText: { fontSize: 14, color: colors.success, lineHeight: 20 },
    startNextButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.success,
      borderRadius: 10,
    },
    startNextButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textInverse,
    },

    // Dev section
    devSection: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      gap: 8,
      backgroundColor: colors.bgSurface,
    },
    devSectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    devNote: { fontSize: 12, color: colors.textTertiary, fontStyle: 'italic' },
    devItem: { paddingLeft: 8, gap: 2 },
    devItemText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    devItemNote: { fontSize: 12, color: colors.textTertiary },
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CycleReviewScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const ratingStyles = useMemo(() => getRatingStyles(colors), [colors]);
  const volumeLevelColors = useMemo(
    () => getVolumeLevelColors(colors),
    [colors]
  );
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    data: review,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    triggerReview,
    isTriggeringReview,
    triggerError,
  } = useCycleReview(programId);

  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    if (review) return;
    const timer = setTimeout(() => setShowRetry(true), 60_000);
    return () => clearTimeout(timer);
  }, [review]);

  const llmData: CycleReviewData = (review ?? {}) as CycleReviewData;

  async function handleAcceptSuggestion(s: FormulaSuggestion) {
    if (!user) return;
    await createFormulaOverride(user.id, {
      overrides: s.overrides,
      source: 'ai_suggestion',
      ai_rationale: s.rationale,
    });
    queryClient.invalidateQueries({ queryKey: ['formula'] });
  }

  async function handleDismissSuggestion(id: string) {
    if (!user) return;
    await deactivateFormulaConfig(id, user.id);
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <BackLink onPress={() => router.back()} />
          <ScreenTitle>Cycle Review</ScreenTitle>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingTitle}>Analysis in progress…</Text>
          <Text style={styles.loadingSubtitle}>
            Generating your coaching review — usually takes under 30 seconds
          </Text>
          {showRetry && (
            <TouchableOpacity
              style={styles.generateButton}
              onPress={() => triggerReview()}
              disabled={isTriggeringReview}
              activeOpacity={0.8}
            >
              <Text style={styles.generateButtonText}>
                {isTriggeringReview
                  ? 'Generating…'
                  : 'Review not ready — tap to retry'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <BackLink onPress={() => router.back()} />
          <ScreenTitle>Cycle Review</ScreenTitle>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingTitle}>Could not load cycle review</Text>
          <Text style={styles.loadingSubtitle}>
            {error instanceof Error ? error.message : 'Please try again.'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void refetch()}
            disabled={isRefetching}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>
              {isRefetching ? 'Retrying…' : 'Retry'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!review) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <BackLink onPress={() => router.back()} />
          <ScreenTitle>Cycle Review</ScreenTitle>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingTitle}>Generating your review…</Text>
          <Text style={styles.loadingSubtitle}>
            {triggerError instanceof Error
              ? `Generation failed: ${triggerError.message}`
              : 'Usually takes under 30 seconds. Checking automatically.'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void refetch()}
            disabled={isRefetching}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>
              {isRefetching ? 'Checking…' : 'Check Now'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.generateButton}
            onPress={() => triggerReview()}
            disabled={isTriggeringReview}
            activeOpacity={0.8}
          >
            <Text style={styles.generateButtonText}>
              {isTriggeringReview ? 'Generating…' : 'Generate Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const progress = llmData.progressByLift ?? {};
  const aux = llmData.auxiliaryInsights ?? {};
  const formulas = llmData.formulaSuggestions ?? [];
  const meta = llmData.meta ?? {};

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
        <ScreenTitle>Cycle Review</ScreenTitle>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Overall summary */}
        {llmData.overallAssessment && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryMeta}>
              {meta.completedSessions != null && meta.totalSessions != null && (
                <Text style={styles.summaryMetaText}>
                  {meta.completedSessions}/{meta.totalSessions} sessions
                  completed
                </Text>
              )}
              {meta.wilksStart != null && meta.wilksEnd != null && (
                <Text style={styles.summaryMetaText}>
                  WILKS {meta.wilksStart} → {meta.wilksEnd} (
                  {meta.wilksEnd > meta.wilksStart ? '+' : ''}
                  {(meta.wilksEnd - meta.wilksStart).toFixed(1)})
                </Text>
              )}
            </View>
            <Text style={styles.overallAssessment}>
              {llmData.overallAssessment}
            </Text>
          </View>
        )}

        {/* 2. Lift progress */}
        {Object.keys(progress).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lift Progress</Text>
            {(['squat', 'bench', 'deadlift'] as string[]).map((lift) => {
              const lp = progress[lift];
              if (!lp) return null;
              const rs = ratingStyles[lp.rating] ?? ratingStyles.good;
              const delta = lp.oneRmEnd - lp.oneRmStart;
              return (
                <View key={lift} style={styles.liftCard}>
                  <View style={styles.liftCardHeader}>
                    <Text style={styles.liftName}>
                      {lift.charAt(0).toUpperCase() + lift.slice(1)}
                    </Text>
                    <View
                      style={[styles.ratingBadge, { backgroundColor: rs.bg }]}
                    >
                      <Text style={[styles.ratingText, { color: rs.text }]}>
                        {rs.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.liftDelta}>
                    {lp.oneRmStart} kg → {lp.oneRmEnd} kg (
                    {delta >= 0 ? '+' : ''}
                    {delta} kg)
                  </Text>
                  {lp.narrative && (
                    <Text style={styles.liftNarrative}>{lp.narrative}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* 3. Auxiliary insights */}
        {aux.mostCorrelated?.length ||
        aux.leastEffective?.length ||
        aux.recommendedChanges?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Auxiliary Insights</Text>

            {aux.mostCorrelated?.length ? (
              <>
                <Text style={styles.auxSubtitle}>
                  Most correlated with progress:
                </Text>
                {aux.mostCorrelated.map((item, i) => (
                  <View key={i} style={styles.auxItem}>
                    <Text style={styles.auxExercise}>{item.exercise}</Text>
                    <Text style={styles.auxExplanation}>
                      {item.explanation}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            {aux.leastEffective?.length ? (
              <>
                <Text style={[styles.auxSubtitle, { marginTop: 12 }]}>
                  Least effective:
                </Text>
                {aux.leastEffective.map((item, i) => (
                  <View key={i} style={styles.auxItem}>
                    <Text style={styles.auxExercise}>{item.exercise}</Text>
                    <Text style={styles.auxExplanation}>
                      {item.explanation}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            {aux.recommendedChanges?.length ? (
              <>
                <Text style={[styles.auxSubtitle, { marginTop: 12 }]}>
                  Recommendations:
                </Text>
                {aux.recommendedChanges.map((change, i) => (
                  <Text key={i} style={styles.auxChange}>
                    • {change}
                  </Text>
                ))}
              </>
            ) : null}
          </View>
        ) : null}

        {/* 4. Volume heatmap */}
        {llmData.weeklyVolume &&
          Object.keys(llmData.weeklyVolume).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Volume Heatmap</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Header */}
                  <View style={styles.heatmapRow}>
                    <View style={styles.heatmapWeekCell} />
                    {MUSCLES.map((m) => (
                      <View key={m} style={styles.heatmapCell}>
                        <Text style={styles.heatmapHeader}>
                          {MUSCLE_LABELS_ABBR[m]}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {/* Data rows */}
                  {Object.entries(llmData.weeklyVolume).map(([week, vol]) => (
                    <View key={week} style={styles.heatmapRow}>
                      <View style={styles.heatmapWeekCell}>
                        <Text style={styles.heatmapWeek}>W{week}</Text>
                      </View>
                      {MUSCLES.map((m) => {
                        const sets =
                          (vol as Record<MuscleGroup, number>)[m] ?? 0;
                        return (
                          <View
                            key={m}
                            style={[
                              styles.heatmapCell,
                              {
                                backgroundColor:
                                  volumeLevelColors[
                                    classifyVolumeLevel(sets, 6, 20)
                                  ],
                              },
                            ]}
                          >
                            <Text style={styles.heatmapValue}>
                              {sets || ''}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

        {/* 5. Formula suggestions */}
        {formulas.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Formula Suggestions</Text>
            {formulas.map((s, i) => {
              const priorityColors = {
                high: colors.dangerMuted,
                medium: colors.warningMuted,
                low: colors.bgMuted,
              } as const;
              return (
                <View key={i} style={styles.suggestionCard}>
                  <View style={styles.suggestionHeader}>
                    <Text style={styles.suggestionDescription}>
                      {s.description}
                    </Text>
                    <View
                      style={[
                        styles.priorityBadge,
                        {
                          backgroundColor:
                            priorityColors[s.priority] ?? colors.bgMuted,
                        },
                      ]}
                    >
                      <Text style={styles.priorityText}>{s.priority}</Text>
                    </View>
                  </View>
                  {s.rationale && (
                    <Text style={styles.suggestionRationale}>
                      {s.rationale}
                    </Text>
                  )}
                  <View style={styles.suggestionActions}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAcceptSuggestion(s)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dismissButton}
                      onPress={() => handleDismissSuggestion(s.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.dismissButtonText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 6. Next cycle recommendations */}
        {llmData.nextCycleRecommendations && (
          <View style={styles.nextCycleCard}>
            <Text style={styles.nextCycleTitle}>Next Cycle</Text>
            <Text style={styles.nextCycleText}>
              {llmData.nextCycleRecommendations}
            </Text>
            <TouchableOpacity
              style={styles.startNextButton}
              onPress={() => router.push('/(auth)/onboarding/program-settings')}
              activeOpacity={0.8}
            >
              <Text style={styles.startNextButtonText}>→ Start Next Cycle</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 7. Developer suggestions (dev mode only) */}
        {__DEV__ && (llmData.structuralSuggestions?.length ?? 0) > 0 && (
          <View style={styles.devSection}>
            <Text style={styles.devSectionTitle}>Developer Suggestions</Text>
            <Text style={styles.devNote}>
              These items require code changes — for developer review only
            </Text>
            {llmData.structuralSuggestions!.map((s, i) => (
              <View key={i} style={styles.devItem}>
                <Text style={styles.devItemText}>{s.description}</Text>
                {s.developerNote && (
                  <Text style={styles.devItemNote}>{s.developerNote}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

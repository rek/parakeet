import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { BadgeCard, detectAchievements, StarCard } from '@modules/achievements';
import { useAuth } from '@modules/auth';
import { stampCyclePhaseOnSession } from '@modules/cycle-tracking';
import {
  checkEndOfWeek,
  completeSession,
  computeSessionStats,
  isNetworkError,
  RPE_OPTIONS,
} from '@modules/session';
import type { EarnedBadge, PR } from '@parakeet/training-engine';
import { useNetworkStatus } from '@platform/network';
import { qk } from '@platform/query';
import { useSessionStore } from '@platform/store/sessionStore';
import { useSyncStore } from '@platform/store/syncStore';
import { captureException } from '@platform/utils/captureException';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

// ── Styles ────────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bgSurface,
    },
    scrollView: {
      flex: 1,
    },
    container: {
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 48,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 24,
      textAlign: 'center',
    },
    statsCard: {
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 16,
      marginBottom: 32,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    statDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    statLabel: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    rpeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 32,
    },
    rpePill: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rpePillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    rpePillText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    rpePillTextActive: {
      color: colors.textInverse,
    },
    notesInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.text,
      minHeight: 100,
      marginBottom: 32,
      backgroundColor: colors.bgSurface,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textInverse,
    },
    syncBanner: {
      backgroundColor: colors.warningMuted,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.warning,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginBottom: 20,
    },
    syncBannerText: {
      fontSize: 13,
      color: colors.warning,
      textAlign: 'center',
    },
    // Achievement surfaces
    starsSection: {
      marginBottom: 20,
    },
    streakLine: {
      backgroundColor: colors.successMuted,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 12,
    },
    streakText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.success,
    },
    streakResetLine: {
      backgroundColor: colors.warningMuted,
    },
    streakResetText: {
      fontSize: 14,
      color: colors.warning,
    },
    cycleBadgeLine: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 20,
    },
    cycleBadgeText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
    },
    reviewPromptCard: {
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 18,
      marginBottom: 20,
    },
    reviewPromptTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    reviewPromptSubtext: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 16,
      lineHeight: 18,
    },
    reviewPromptButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    reviewButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    reviewButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textInverse,
    },
    reviewSkipButton: {
      flex: 1,
      backgroundColor: colors.bgMuted,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    reviewSkipButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function CompleteScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const { enqueue } = useSyncStore();

  const {
    sessionId,
    actualSets,
    auxiliarySets,
    sessionRpe,
    startedAt,
    plannedSets,
    setSessionRpe,
    reset,
  } = useSessionStore();

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);

  // Post-save achievement state
  const [earnedPRs, setEarnedPRs] = useState<PR[]>([]);
  const [streakWeeks, setStreakWeeks] = useState<number | null>(null);
  const [streakReset, setStreakReset] = useState(false);
  const [cycleBadgeEarned, setCycleBadgeEarned] = useState(false);
  const [newBadges, setNewBadges] = useState<EarnedBadge[]>([]);
  const [saved, setSaved] = useState(false);

  // End-of-week body review prompt
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [reviewProgramId, setReviewProgramId] = useState<string | null>(null);
  const [reviewWeekNumber, setReviewWeekNumber] = useState(0);

  // ── Derived stats ─────────────────────────────────────────────────────────

  // For free-form ad-hoc (no main lift sets), use auxiliary sets for stats
  const { totalSets, completedSets, completionPct } = computeSessionStats(
    actualSets,
    auxiliarySets
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSaveAndFinish() {
    if (!sessionId || !user) {
      Alert.alert('Error', 'Session data is missing — please restart the app.');
      return;
    }

    // Build payload once (used for both online save and offline queue)
    const notesValue = notes.trim() || undefined;
    const completionPayload = {
      sessionId,
      userId: user.id,
      actualSets: actualSets.map((s) => ({
        set_number: s.set_number,
        weight_grams: s.weight_grams,
        reps_completed: s.reps_completed,
        is_completed: s.is_completed,
        rpe_actual: s.rpe_actual,
        actual_rest_seconds: s.actual_rest_seconds,
        notes: notesValue,
      })),
      auxiliarySets:
        auxiliarySets.length > 0
          ? auxiliarySets.map((s) => ({
              exercise: s.exercise,
              set_number: s.set_number,
              weight_grams: s.weight_grams,
              reps_completed: s.reps_completed,
              is_completed: s.is_completed,
              rpe_actual: s.rpe_actual,
              actual_rest_seconds: s.actual_rest_seconds,
            }))
          : undefined,
      sessionRpe,
      startedAt: startedAt?.toISOString(),
    };

    // Offline: queue and show optimistic success
    if (!isOnline) {
      enqueue({ operation: 'complete_session', payload: completionPayload });
      setPendingSync(true);
      setSaved(true);
      return;
    }

    setSaving(true);
    try {
      await completeSession(sessionId, user.id, {
        actualSets: completionPayload.actualSets,
        auxiliarySets: completionPayload.auxiliarySets,
        sessionRpe,
        startedAt,
        completedAt: new Date(),
      });

      // Stamp cycle phase on the session log (no-op if tracking disabled)
      stampCyclePhaseOnSession(user.id, sessionId).catch((err) =>
        captureException(err)
      );

      // Data is committed — show the saved state regardless of what follows
      setSaved(true);

      void queryClient.invalidateQueries({ queryKey: ['session'] });
      void queryClient.invalidateQueries({
        queryKey: ['sessions', 'completed'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['performance', 'trends'],
      });
      void queryClient.invalidateQueries({ queryKey: ['achievements'] });
      void queryClient.invalidateQueries({ queryKey: ['volume', 'weekly'] });
      void queryClient.invalidateQueries({
        queryKey: qk.program.active(user?.id),
      });

      // ── Achievement detection (best-effort) ───────────────────────────────
      try {
        const achievements = await detectAchievements(
          sessionId,
          user.id,
          actualSets
        );
        if (achievements.earnedPRs.length > 0)
          setEarnedPRs(achievements.earnedPRs);
        if (achievements.streakWeeks !== null)
          setStreakWeeks(achievements.streakWeeks);
        setStreakReset(achievements.streakReset);
        if (achievements.cycleBadgeEarned) setCycleBadgeEarned(true);
        if (achievements.newBadges.length > 0)
          setNewBadges(achievements.newBadges);
      } catch (achievementErr) {
        captureException(achievementErr);
      }

      // ── End-of-week body review prompt (best-effort) ──────────────────────
      try {
        const eow = await checkEndOfWeek(sessionId);
        if (eow.shouldPrompt) {
          setReviewProgramId(eow.programId);
          setReviewWeekNumber(eow.weekNumber);
          setShowReviewPrompt(true);
        }
      } catch (eowErr) {
        captureException(eowErr);
      }
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        // Lost connection mid-save: queue for retry
        enqueue({ operation: 'complete_session', payload: completionPayload });
        setPendingSync(true);
        setSaved(true);
      } else {
        captureException(err);
        Alert.alert(
          'Could not save workout',
          err instanceof Error
            ? err.message
            : 'An error occurred — please try again.'
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDone() {
    router.replace('/(tabs)/today');
    setTimeout(reset, 400);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Text style={styles.title}>Workout Complete 🎉</Text>

        {/* Pending sync indicator */}
        {pendingSync && (
          <View style={styles.syncBanner}>
            <Text style={styles.syncBannerText}>
              Syncing when connection restores...
            </Text>
          </View>
        )}

        {/* Stats card */}
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Completion</Text>
            <Text style={styles.statValue}>{completionPct}%</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Sets completed</Text>
            <Text style={styles.statValue}>
              {completedSets}/{totalSets}
            </Text>
          </View>
          {plannedSets.length > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Sets planned</Text>
                <Text style={styles.statValue}>{plannedSets.length}</Text>
              </View>
            </>
          )}
        </View>

        {!saved ? (
          <>
            {/* Session RPE */}
            <Text style={styles.sectionLabel}>Overall Session RPE</Text>
            <View style={styles.rpeRow}>
              {RPE_OPTIONS.map((level) => {
                const isActive = sessionRpe === level;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[styles.rpePill, isActive && styles.rpePillActive]}
                    onPress={() => setSessionRpe(level)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.rpePillText,
                        isActive && styles.rpePillTextActive,
                      ]}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notes */}
            <Text style={styles.sectionLabel}>Session Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="How did it feel? Any issues?"
              placeholderTextColor={colors.textTertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              returnKeyType="default"
            />

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSaveAndFinish}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save & Finish'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Stars */}
            {earnedPRs.length > 0 && (
              <View style={styles.starsSection}>
                {earnedPRs.map((pr, i) => (
                  <StarCard
                    key={`${pr.type}-${pr.lift}-${i}`}
                    pr={pr}
                    delay={i * 200}
                  />
                ))}
              </View>
            )}

            {/* Fun badges */}
            {newBadges.length > 0 && (
              <View style={styles.starsSection}>
                {newBadges.map((badge, i) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    delay={earnedPRs.length * 200 + i * 200}
                  />
                ))}
              </View>
            )}

            {/* Streak update */}
            {streakWeeks !== null && (
              <View style={styles.streakLine}>
                <Text style={styles.streakText}>
                  Week {streakWeeks} clean ✓
                </Text>
              </View>
            )}
            {streakReset && (
              <View style={[styles.streakLine, styles.streakResetLine]}>
                <Text style={styles.streakResetText}>
                  Streak reset — log disruptions to protect your streak
                </Text>
              </View>
            )}

            {/* Cycle badge */}
            {cycleBadgeEarned && (
              <View style={styles.cycleBadgeLine}>
                <Text style={styles.cycleBadgeText}>Cycle complete! 🏆</Text>
              </View>
            )}

            {/* End-of-week body review prompt */}
            {showReviewPrompt && (
              <View style={styles.reviewPromptCard}>
                <Text style={styles.reviewPromptTitle}>
                  End of week — how does your body feel?
                </Text>
                <Text style={styles.reviewPromptSubtext}>
                  Compare how you feel vs what the system predicted
                </Text>
                <View style={styles.reviewPromptButtons}>
                  <TouchableOpacity
                    style={styles.reviewButton}
                    onPress={() => {
                      setShowReviewPrompt(false);
                      router.push({
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        pathname: '/session/weekly-review' as any,
                        params: {
                          programId: reviewProgramId ?? '',
                          weekNumber: String(reviewWeekNumber),
                        },
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.reviewButtonText}>Review</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reviewSkipButton}
                    onPress={() => setShowReviewPrompt(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reviewSkipButtonText}>Skip</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Done button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleDone}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>Done</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

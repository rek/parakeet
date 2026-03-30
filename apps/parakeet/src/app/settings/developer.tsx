import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@modules/auth';
import {
  deleteAllUserData,
  getJITStrategyOverride,
  setJITStrategyOverride,
  useDeveloperSuggestions,
} from '@modules/settings';
import type {
  DeveloperSuggestion,
  JITStrategyOverride,
} from '@modules/settings';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../components/navigation/BackLink';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

// ── Constants ─────────────────────────────────────────────────────────────────

interface StrategyOption {
  value: JITStrategyOverride;
  label: string;
  description: string;
}

const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'LLM when online, formula when offline',
  },
  {
    value: 'formula',
    label: 'Formula only',
    description: 'Deterministic rule-based — always offline',
  },
  {
    value: 'llm',
    label: 'LLM only',
    description: 'AI-generated — requires network',
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Runs both in parallel; shows comparison in session',
  },
];

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
      paddingTop: 16,
      paddingBottom: 48,
    },
    header: {
      marginBottom: 8,
    },
    screenSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    divider: {
      height: 1,
      backgroundColor: colors.bgMuted,
      marginBottom: 24,
    },
    sectionHeader: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    sectionNote: {
      fontSize: 13,
      color: colors.textTertiary,
      marginBottom: 16,
      lineHeight: 18,
    },
    strategyList: {
      gap: 8,
    },
    strategyRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.bgSurface,
    },
    strategyRowSelected: {
      borderColor: colors.text,
      backgroundColor: colors.bgSurface,
    },
    strategyRadio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: 12,
      marginTop: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    strategyRadioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.text,
    },
    strategyText: {
      flex: 1,
    },
    strategyLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    strategyLabelSelected: {
      color: colors.text,
    },
    strategyDescription: {
      fontSize: 13,
      color: colors.textTertiary,
      lineHeight: 18,
    },
    loader: {
      marginTop: 24,
    },
    savingLabel: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 12,
    },

    // Cycle Feedback section
    cycleFeedbackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    unreviewedBadge: {
      backgroundColor: colors.dangerMuted,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    unreviewedBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.danger,
    },
    emptyText: { fontSize: 14, color: colors.textTertiary, paddingVertical: 8 },
    suggestionList: { gap: 12 },

    // Suggestion card
    suggestionCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      gap: 8,
      backgroundColor: colors.bgSurface,
    },
    suggestionCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    suggestionDate: { fontSize: 11, color: colors.textTertiary },
    suggestionDescription: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 20,
    },
    suggestionRationale: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    devNoteContainer: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 8,
      padding: 10,
      gap: 2,
    },
    devNoteLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    devNoteText: { fontSize: 13, color: colors.primary, lineHeight: 18 },
    suggestionActions: { flexDirection: 'row', gap: 8, paddingTop: 4 },
    acknowledgeBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 9,
      alignItems: 'center',
    },
    acknowledgeBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textInverse,
    },
    dismissBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 9,
      alignItems: 'center',
      backgroundColor: colors.bgSurface,
    },
    dismissBtnText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },

    // Priority badge
    priorityBadge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    priorityBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

    // History
    historySummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.bgMuted,
      marginTop: 4,
    },
    historySummaryText: { fontSize: 13, color: colors.textSecondary },
    historyChevron: { fontSize: 11, color: colors.textTertiary },
    historyCard: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.bgSurface,
      borderRadius: 8,
      gap: 4,
      marginTop: 4,
    },
    historyCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    historyStatus: {
      fontSize: 11,
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    historyDescription: { fontSize: 13, color: colors.textSecondary },
    historyDate: { fontSize: 11, color: colors.textTertiary },

    // Reset section
    deleteBtn: {
      backgroundColor: colors.danger,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    deleteBtnDisabled: {
      opacity: 0.5,
    },
    deleteBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textInverse,
    },
  });
}

type Styles = ReturnType<typeof buildStyles>;

// ── Cycle Feedback sub-components ─────────────────────────────────────────────

interface PriorityBadgeProps {
  priority: DeveloperSuggestion['priority'];
  styles: Styles;
  colors: ColorScheme;
}

function PriorityBadge({ priority, styles, colors }: PriorityBadgeProps) {
  const color =
    priority === 'high'
      ? colors.danger
      : priority === 'medium'
        ? colors.warning
        : colors.textTertiary;
  const bg =
    priority === 'high'
      ? colors.dangerMuted
      : priority === 'medium'
        ? colors.warningMuted
        : colors.bgMuted;
  return (
    <View style={[styles.priorityBadge, { backgroundColor: bg }]}>
      <Text style={[styles.priorityBadgeText, { color }]}>
        {priority.toUpperCase()}
      </Text>
    </View>
  );
}

interface SuggestionCardProps {
  suggestion: DeveloperSuggestion;
  onAcknowledge: () => void;
  onDismiss: () => void;
  isUpdating: boolean;
  styles: Styles;
  colors: ColorScheme;
}

function SuggestionCard({
  suggestion,
  onAcknowledge,
  onDismiss,
  isUpdating,
  styles,
  colors,
}: SuggestionCardProps) {
  return (
    <View style={styles.suggestionCard}>
      <View style={styles.suggestionCardHeader}>
        <PriorityBadge
          priority={suggestion.priority}
          styles={styles}
          colors={colors}
        />
        <Text style={styles.suggestionDate}>
          {new Date(suggestion.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
      <Text style={styles.suggestionRationale}>{suggestion.rationale}</Text>
      <View style={styles.devNoteContainer}>
        <Text style={styles.devNoteLabel}>Dev note</Text>
        <Text style={styles.devNoteText}>{suggestion.developer_note}</Text>
      </View>
      {isUpdating ? (
        <View style={styles.suggestionActions}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      ) : (
        <View style={styles.suggestionActions}>
          <TouchableOpacity
            style={styles.acknowledgeBtn}
            onPress={onAcknowledge}
            activeOpacity={0.7}
          >
            <Text style={styles.acknowledgeBtnText}>Acknowledge</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissBtnText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── JIT Strategy sub-components ────────────────────────────────────────────────

interface StrategyRowProps {
  option: StrategyOption;
  selected: boolean;
  onPress: () => void;
  styles: Styles;
}

function StrategyRow({ option, selected, onPress, styles }: StrategyRowProps) {
  return (
    <TouchableOpacity
      style={[styles.strategyRow, selected && styles.strategyRowSelected]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={styles.strategyRadio}>
        {selected && <View style={styles.strategyRadioInner} />}
      </View>
      <View style={styles.strategyText}>
        <Text
          style={[
            styles.strategyLabel,
            selected && styles.strategyLabelSelected,
          ]}
        >
          {option.label}
        </Text>
        <Text style={styles.strategyDescription}>{option.description}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DeveloperSettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { user, signOut } = useAuth();
  const [strategy, setStrategy] = useState<JITStrategyOverride>('auto');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { suggestions, updateStatus } = useDeveloperSuggestions();

  useEffect(() => {
    getJITStrategyOverride()
      .then(setStrategy)
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = useCallback(
    async (value: JITStrategyOverride) => {
      if (saving || value === strategy) return;
      setSaving(true);
      setStrategy(value);
      try {
        await setJITStrategyOverride(value);
      } finally {
        setSaving(false);
      }
    },
    [saving, strategy]
  );

  const unreviewed = suggestions.filter((s) => s.status === 'unreviewed');
  const reviewed = suggestions.filter((s) => s.status !== 'unreviewed');
  const acknowledgedCount = reviewed.filter(
    (s) => s.status === 'acknowledged'
  ).length;
  const implementedCount = reviewed.filter(
    (s) => s.status === 'implemented'
  ).length;
  const dismissedCount = reviewed.filter(
    (s) => s.status === 'dismissed'
  ).length;

  async function handleUpdateSuggestion(
    id: string,
    status: 'acknowledged' | 'implemented' | 'dismissed'
  ) {
    setUpdatingId(id);
    try {
      await updateStatus(id, status);
    } finally {
      setUpdatingId(null);
    }
  }

  function handleDeleteAllData() {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your training data and sign you out. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id || isDeleting) return;
            setIsDeleting(true);
            try {
              await deleteAllUserData(user.id);
              await signOut();
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackLink label="Settings" onPress={() => router.back()} />
        </View>

        <ScreenTitle marginBottom={8}>Developer</ScreenTitle>
        <Text style={styles.screenSubtitle}>
          Options for testing and debugging the training engine.
        </Text>

        <View style={styles.divider} />

        {/* JIT Strategy section */}
        <Text style={styles.sectionHeader}>JIT Strategy</Text>
        <Text style={styles.sectionNote}>
          Override which generator produces planned sets at session start.
          Changes take effect on the next session generation.
        </Text>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.text} />
        ) : (
          <View style={styles.strategyList}>
            {STRATEGY_OPTIONS.map((option) => (
              <StrategyRow
                key={option.value}
                option={option}
                selected={strategy === option.value}
                onPress={() => void handleSelect(option.value)}
                styles={styles}
              />
            ))}
          </View>
        )}

        {saving && <Text style={styles.savingLabel}>Saving...</Text>}

        <View style={styles.divider} />

        {/* Cycle Feedback section */}
        <View style={styles.cycleFeedbackHeader}>
          <Text style={styles.sectionHeader}>Cycle Feedback</Text>
          {unreviewed.length > 0 && (
            <View style={styles.unreviewedBadge}>
              <Text style={styles.unreviewedBadgeText}>
                {unreviewed.length} unreviewed
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.sectionNote}>
          Structural suggestions from cycle review analysis that require code
          changes.
        </Text>

        {unreviewed.length === 0 && (
          <Text style={styles.emptyText}>No unreviewed suggestions.</Text>
        )}

        <View style={styles.suggestionList}>
          {unreviewed.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              isUpdating={updatingId === s.id}
              onAcknowledge={() =>
                void handleUpdateSuggestion(s.id, 'acknowledged')
              }
              onDismiss={() => void handleUpdateSuggestion(s.id, 'dismissed')}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>

        {reviewed.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.historySummaryRow}
              onPress={() => setShowHistory((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.historySummaryText}>
                {[
                  acknowledgedCount > 0
                    ? `Acknowledged (${acknowledgedCount})`
                    : null,
                  implementedCount > 0
                    ? `Implemented (${implementedCount})`
                    : null,
                  dismissedCount > 0 ? `Dismissed (${dismissedCount})` : null,
                ]
                  .filter(Boolean)
                  .join('  ')}
              </Text>
              <Text style={styles.historyChevron}>
                {showHistory ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {showHistory &&
              reviewed.map((s) => (
                <View key={s.id} style={styles.historyCard}>
                  <View style={styles.historyCardHeader}>
                    <PriorityBadge
                      priority={s.priority}
                      styles={styles}
                      colors={colors}
                    />
                    <Text style={styles.historyStatus}>{s.status}</Text>
                  </View>
                  <Text style={styles.historyDescription}>{s.description}</Text>
                  {s.reviewed_at && (
                    <Text style={styles.historyDate}>
                      {new Date(s.reviewed_at).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              ))}
          </>
        )}
        <View style={styles.divider} />

        {/* Reset section */}
        <Text style={styles.sectionHeader}>Reset</Text>
        <Text style={styles.sectionNote}>
          Wipes all training data and signs you out. Cannot be undone.
        </Text>
        <TouchableOpacity
          style={[styles.deleteBtn, isDeleting && styles.deleteBtnDisabled]}
          onPress={handleDeleteAllData}
          disabled={isDeleting}
          activeOpacity={0.7}
        >
          {isDeleting ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={styles.deleteBtnText}>Delete All Data</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

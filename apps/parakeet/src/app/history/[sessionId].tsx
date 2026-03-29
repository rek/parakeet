import { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  AuxResultsTable,
  MainLiftResultsTable,
  parsePlannedSetsJson,
  SessionContextCard,
  SummaryChipsRow,
  TraceButton,
  useSessionDetail,
} from '@modules/session';
import type { Lift } from '@parakeet/shared-types';
import { LIFT_LABELS } from '@shared/constants';
import { formatDate, formatTime } from '@shared/utils/date';
import { capitalize } from '@shared/utils/string';
import { VideoEntryButton } from '@modules/video-analysis';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../components/navigation/BackLink';
import { spacing, typography } from '../../theme';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

export default function SessionDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const result = useSessionDetail({ sessionId: sessionId ?? '' });

  if (result.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (result.status === 'error') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <BackLink onPress={() => router.back()} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Failed to load session.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (result.status === 'not-found') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <BackLink onPress={() => router.back()} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Session not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { session, log, jitSnapshot, prescriptionTrace } = result;

  const liftLabel =
    LIFT_LABELS[session.primary_lift as Lift] ??
    capitalize(session.primary_lift ?? '');
  const intensityLabel = capitalize(session.intensity_type ?? '');
  const completedAt = session.completed_at ?? null;
  const dateLabel = formatDate(completedAt ?? session.planned_date);
  const timeLabel = completedAt ? formatTime(completedAt) : '';

  const mainSets = log?.actual_sets ?? [];
  const auxSets = log?.auxiliary_sets ?? [];
  const plannedSets = parsePlannedSetsJson(session.planned_sets);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          {liftLabel} — {intensityLabel}
        </Text>
        <Text style={styles.subtitle}>
          Week {session.week_number}
          {session.block_number
            ? ` · Block ${session.block_number}`
            : ''} · {dateLabel}
          {timeLabel ? ` · ${timeLabel}` : ''}
        </Text>

        <VideoEntryButton sessionId={session.id} lift={session.primary_lift} variant="link" />

        {log && (
          <SummaryChipsRow
            sessionRpe={log.session_rpe}
            completionPct={log.completion_pct}
            performanceVsPlan={log.performance_vs_plan}
            colors={colors}
          />
        )}

        {jitSnapshot && (
          <SessionContextCard
            sorenessRatings={jitSnapshot.sorenessRatings}
            sleepQuality={jitSnapshot.sleepQuality}
            energyLevel={jitSnapshot.energyLevel}
            activeDisruptions={jitSnapshot.activeDisruptions}
            colors={colors}
          />
        )}

        <MainLiftResultsTable
          mainSets={mainSets}
          plannedSets={plannedSets}
          colors={colors}
        />

        <AuxResultsTable auxiliarySets={auxSets} colors={colors} />

        {!log && (
          <Text style={styles.emptyText}>
            No set data recorded for this session.
          </Text>
        )}

        {prescriptionTrace && (
          <TraceButton prescriptionTrace={prescriptionTrace} colors={colors} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[12],
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weights.black,
      color: colors.text,
      marginBottom: spacing[1],
      letterSpacing: typography.letterSpacing.tight,
    },
    subtitle: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing[5],
    },
    emptyText: {
      fontSize: typography.sizes.base,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: spacing[8],
    },
  });
}

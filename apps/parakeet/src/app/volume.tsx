import { useMemo, useState } from 'react';
import type { DimensionValue } from 'react-native';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  classifyConfigSource,
  getVolumeStatusColor,
  isVolumeOverMrv,
  useWeeklyVolume,
  volumeFillPct,
} from '@modules/training-volume';
import type { VolumeStatus } from '@modules/training-volume';
import type { MuscleGroup } from '@parakeet/shared-types';
import {
  MUSCLE_GROUPS_ORDER,
  MUSCLE_LABELS_FULL,
} from '@shared/constants/training';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../components/navigation/BackLink';
import { ScreenTitle } from '../components/ui/ScreenTitle';
import type { ColorScheme } from '../theme';
import { useTheme } from '../theme/ThemeContext';

type Breakdown = Awaited<ReturnType<typeof useWeeklyVolume>['data']>;
type MuscleBreakdown = NonNullable<Breakdown>['breakdown'][MuscleGroup];

interface MuscleBarProps {
  muscle: MuscleGroup;
  sets: number;
  mrv: number;
  mev: number;
  proRatedMev: number;
  isPartialWeek: boolean;
  status: VolumeStatus;
  expanded: boolean;
  breakdown: MuscleBreakdown;
  biologicalSex: 'male' | 'female' | null;
  onToggle: () => void;
  colors: ColorScheme;
  styles: ReturnType<typeof buildStyles>;
}

function MuscleBar({
  muscle,
  sets,
  mrv,
  mev,
  proRatedMev,
  isPartialWeek,
  status,
  expanded,
  breakdown,
  biologicalSex,
  onToggle,
  colors,
  styles,
}: MuscleBarProps) {
  const fillPct = volumeFillPct(sets, mrv);
  const mevPct = mrv > 0 ? (mev / mrv) * 100 : 0;
  const color = getVolumeStatusColor(status, colors);
  const isOver = isVolumeOverMrv(status);

  const configSource = classifyConfigSource({
    config: { [muscle]: { mev, mrv } } as Parameters<
      typeof classifyConfigSource
    >[0]['config'],
    muscle,
    biologicalSex,
  });

  return (
    <View style={styles.barRow}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${MUSCLE_LABELS_FULL[muscle]} volume details`}
      >
        <View style={styles.barLabelRow}>
          <Text style={styles.barLabel}>{MUSCLE_LABELS_FULL[muscle]}</Text>
          <Text style={styles.chevron}>{expanded ? '\u25BE' : '\u25B8'}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.barContainer}>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${fillPct}%`, backgroundColor: color },
            ]}
          />
          {mevPct > 0 && (
            <View
              style={[
                styles.mevMarker,
                { left: `${mevPct}%` as DimensionValue },
              ]}
            />
          )}
          <View style={styles.mrvMarker} />
        </View>
        <View style={styles.barStats}>
          <Text style={[styles.barSets, isOver && styles.barSetsOver]}>
            {sets}
            {isOver ? ' ⚠' : ''}
          </Text>
          <Text style={styles.barMrv}>/{mrv}</Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.detailContainer}>
          {breakdown.contributions.length === 0 ? (
            <Text style={styles.detailEmpty}>No volume this week</Text>
          ) : (
            breakdown.contributions.map((c) => {
              const hasRpeScaling = c.rawSets !== c.effectiveSets;
              const setsLabel = hasRpeScaling
                ? `${c.rawSets}s (eff. ${c.effectiveSets})`
                : `${c.rawSets}s`;
              return (
                <View key={c.source} style={styles.detailRow}>
                  <Text style={styles.detailSource} numberOfLines={1}>
                    {c.source}
                  </Text>
                  <Text style={styles.detailFormula}>
                    {setsLabel} x {c.contribution}
                  </Text>
                  <Text style={styles.detailValue}>
                    {c.volumeAdded.toFixed(1)}
                  </Text>
                </View>
              );
            })
          )}
          <Text style={styles.reasoningText}>
            MRV {mrv} · MEV {mev}
            {isPartialWeek && proRatedMev > 0 && proRatedMev < mev
              ? ` (on track: ${proRatedMev})`
              : ''}
            {'  '}
            {configSource.isCustom
              ? `Custom (default: ${configSource.defaultMrv} / ${configSource.defaultMev})`
              : `Research defaults (${biologicalSex ?? 'male'})`}
          </Text>
        </View>
      )}
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bgSurface,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.bgMuted,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 40,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 8,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 11,
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    markerNotes: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 20,
    },
    markerNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    mevMarkerSample: {
      width: 2,
      height: 12,
      backgroundColor: colors.text,
    },
    mrvMarkerSample: {
      width: 2,
      height: 12,
      backgroundColor: colors.textTertiary,
    },
    mevNoteText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 32,
    },
    bars: {
      gap: 16,
    },
    barRow: {
      gap: 6,
    },
    barLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    barLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    chevron: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    barContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    barTrack: {
      flex: 1,
      height: 12,
      backgroundColor: colors.bgMuted,
      borderRadius: 6,
      overflow: 'visible',
      position: 'relative',
    },
    barFill: {
      height: '100%',
      borderRadius: 6,
    },
    mevMarker: {
      position: 'absolute',
      top: -2,
      width: 2,
      height: 16,
      backgroundColor: colors.text,
      borderRadius: 1,
    },
    mrvMarker: {
      position: 'absolute',
      right: 0,
      top: -2,
      width: 2,
      height: 16,
      backgroundColor: colors.textTertiary,
      borderRadius: 1,
    },
    barStats: {
      flexDirection: 'row',
      alignItems: 'baseline',
      width: 64,
      justifyContent: 'flex-end',
    },
    barSets: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    barMrv: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    barSetsOver: {
      color: colors.danger,
    },
    detailContainer: {
      paddingLeft: 4,
      paddingBottom: 4,
      gap: 3,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    detailSource: {
      flex: 1,
      fontSize: 12,
      color: colors.text,
    },
    detailFormula: {
      fontSize: 11,
      color: colors.textSecondary,
      width: 110,
      textAlign: 'right',
    },
    detailValue: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      width: 36,
      textAlign: 'right',
    },
    detailEmpty: {
      fontSize: 12,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    reasoningText: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 4,
    },
  });
}

export default function VolumeScreen() {
  const { colors } = useTheme();
  const { data, isLoading } = useWeeklyVolume();
  const [expandedMuscle, setExpandedMuscle] = useState<MuscleGroup | null>(
    null
  );

  const styles = useMemo(() => buildStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
        <ScreenTitle>Weekly Volume</ScreenTitle>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Sets completed in the last 7 days · tap a muscle for breakdown
        </Text>

        <View style={styles.legend}>
          {(
            [
              'below_mev',
              'in_range',
              'approaching_mrv',
              'at_mrv',
            ] as VolumeStatus[]
          ).map((s) => (
            <View key={s} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: getVolumeStatusColor(s, colors) },
                ]}
              />
              <Text style={styles.legendText}>{s.replace(/_/g, ' ')}</Text>
            </View>
          ))}
        </View>

        <View style={styles.markerNotes}>
          <View style={styles.markerNote}>
            <View style={styles.mevMarkerSample} />
            <Text style={styles.mevNoteText}>MEV</Text>
          </View>
          <View style={styles.markerNote}>
            <View style={styles.mrvMarkerSample} />
            <Text style={styles.mevNoteText}>MRV</Text>
          </View>
        </View>

        {isLoading || !data ? (
          <Text style={styles.loadingText}>Loading…</Text>
        ) : (
          <View style={styles.bars}>
            {MUSCLE_GROUPS_ORDER.map((muscle) => {
              const mev = data.config[muscle].mev;
              const total = data.totalSessionsPerWeek;
              const done = data.completedSessions;
              const isPartialWeek = done < total;
              const proRatedMev = isPartialWeek
                ? Math.ceil((mev * done) / total)
                : mev;
              return (
                <MuscleBar
                  key={muscle}
                  muscle={muscle}
                  sets={data.weekly[muscle]}
                  mrv={data.config[muscle].mrv}
                  mev={mev}
                  proRatedMev={proRatedMev}
                  isPartialWeek={isPartialWeek}
                  status={data.status[muscle]}
                  expanded={expandedMuscle === muscle}
                  breakdown={data.breakdown[muscle]}
                  biologicalSex={data.biologicalSex}
                  onToggle={() =>
                    setExpandedMuscle((prev) =>
                      prev === muscle ? null : muscle
                    )
                  }
                  colors={colors}
                  styles={styles}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

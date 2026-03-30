import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getPrimaryMuscles } from '@modules/program';
import { AddExerciseModal } from '@modules/session';
import { useAuxiliaryPools } from '@modules/settings';
import { MuscleChips } from '@modules/training-volume';
import type { Lift } from '@parakeet/shared-types';
import { getExerciseType } from '@shared/utils/exercise-lookup';
import { TRAINING_LIFTS } from '@shared/constants/training';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../components/navigation/BackLink';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const LIFTS = TRAINING_LIFTS;

const LIFT_LABELS: Record<Lift, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
};

// ── Styles ─────────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bgSurface },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.bgMuted,
      gap: 2,
    },
    subtitle: { fontSize: 12, color: colors.textTertiary, lineHeight: 16 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    content: { paddingBottom: 48 },

    liftSection: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.bgMuted,
      gap: 10,
    },
    liftHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    liftTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    saveBtn: {
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgSurface,
    },
    saveBtnDirty: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    saveBtnTextDirty: { color: colors.textInverse },

    poolList: { gap: 4 },
    emptyPool: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    emptyPoolText: {
      fontSize: 13,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    poolItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: colors.bgSurface,
      borderRadius: 8,
      gap: 8,
    },
    poolPosition: {
      fontSize: 12,
      color: colors.textTertiary,
      width: 20,
      textAlign: 'right',
      paddingTop: 2,
    },
    poolExerciseCol: { flex: 1, gap: 4 },
    poolExerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    poolExercise: { fontSize: 14, color: colors.text, flexShrink: 1 },
    bwBadge: {
      backgroundColor: colors.bgMuted,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    bwBadgeText: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    poolActions: { flexDirection: 'row', gap: 4, paddingTop: 2 },
    reorderBtn: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reorderBtnDisabled: { opacity: 0.25 },
    reorderBtnText: { fontSize: 14, color: colors.textSecondary },
    removeBtn: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: colors.dangerMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeBtnText: { fontSize: 16, color: colors.danger, lineHeight: 20 },

    addBtn: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 4,
    },
    addBtnText: { fontSize: 14, fontWeight: '600', color: colors.textInverse },

    blockAssignmentsLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 4,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.bgSurface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    blockAssignmentsLinkText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    blockAssignmentsChevron: { fontSize: 20, color: colors.textSecondary },
  });
}

// ── Pool list ─────────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof buildStyles>;

interface PoolListProps {
  pool: string[];
  onReorder: (pool: string[]) => void;
  onRemove: (i: number) => void;
  styles: Styles;
  primaryColor: string;
}

function PoolList({ pool, onReorder, onRemove, styles }: PoolListProps) {
  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...pool];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onReorder(next);
  }

  function moveDown(i: number) {
    if (i === pool.length - 1) return;
    const next = [...pool];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onReorder(next);
  }

  if (pool.length === 0) {
    return (
      <View style={styles.emptyPool}>
        <Text style={styles.emptyPoolText}>
          No exercises in pool — add one below.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.poolList}>
      {pool.map((ex, i) => {
        const isBW = getExerciseType(ex) === 'bodyweight';
        return (
          <View key={`${ex}-${i}`} style={styles.poolItem}>
            <Text style={styles.poolPosition}>{i + 1}.</Text>
            <View style={styles.poolExerciseCol}>
              <View style={styles.poolExerciseRow}>
                <Text style={styles.poolExercise} numberOfLines={1}>
                  {ex}
                </Text>
                {isBW && (
                  <View style={styles.bwBadge}>
                    <Text style={styles.bwBadgeText}>BW</Text>
                  </View>
                )}
              </View>
              <MuscleChips muscles={getPrimaryMuscles(ex)} />
            </View>
            <View style={styles.poolActions}>
              <TouchableOpacity
                style={[
                  styles.reorderBtn,
                  i === 0 && styles.reorderBtnDisabled,
                ]}
                onPress={() => moveUp(i)}
                disabled={i === 0}
                activeOpacity={0.7}
              >
                <Text style={styles.reorderBtnText}>↑</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.reorderBtn,
                  i === pool.length - 1 && styles.reorderBtnDisabled,
                ]}
                onPress={() => moveDown(i)}
                disabled={i === pool.length - 1}
                activeOpacity={0.7}
              >
                <Text style={styles.reorderBtnText}>↓</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => onRemove(i)}
                activeOpacity={0.7}
              >
                <Text style={styles.removeBtnText}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Lift section ──────────────────────────────────────────────────────────────

interface LiftSectionProps {
  lift: Lift;
  pool: string[];
  isSavingPool: boolean;
  isDirtyPool: boolean;
  onPoolChange: (pool: string[]) => void;
  onSavePool: () => void;
  styles: Styles;
  primaryColor: string;
}

function LiftSection({
  lift,
  pool,
  isSavingPool,
  isDirtyPool,
  onPoolChange,
  onSavePool,
  styles,
  primaryColor,
}: LiftSectionProps) {
  const [pickerVisible, setPickerVisible] = useState(false);

  function addExercise(name: string) {
    if (!name || pool.includes(name)) return;
    onPoolChange([...pool, name]);
  }

  function removeExercise(i: number) {
    onPoolChange(pool.filter((_, idx) => idx !== i));
  }

  return (
    <View style={styles.liftSection}>
      <View style={styles.liftHeader}>
        <Text style={styles.liftTitle}>{LIFT_LABELS[lift]}</Text>
        <TouchableOpacity
          style={[
            styles.saveBtn,
            isDirtyPool && styles.saveBtnDirty,
            isSavingPool && styles.saveBtnDisabled,
          ]}
          onPress={onSavePool}
          disabled={isSavingPool}
          activeOpacity={0.8}
        >
          {isSavingPool ? (
            <ActivityIndicator color={primaryColor} size="small" />
          ) : (
            <Text
              style={[
                styles.saveBtnText,
                isDirtyPool && styles.saveBtnTextDirty,
              ]}
            >
              {isDirtyPool ? 'Save Pool ·' : 'Save Pool'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Pool Order</Text>
      <PoolList
        pool={pool}
        onReorder={onPoolChange}
        onRemove={removeExercise}
        styles={styles}
        primaryColor={primaryColor}
      />

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setPickerVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.addBtnText}>+ Add Exercise</Text>
      </TouchableOpacity>
      <AddExerciseModal
        visible={pickerVisible}
        onConfirm={(name) => {
          addExercise(name);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
        defaultLift={lift}
        excludeNames={pool}
      />
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

type Pools = Record<Lift, string[]>;

export default function AuxiliaryExercisesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [pools, setPools] = useState<Pools | null>(null);
  const [savingPool, setSavingPool] = useState<Partial<Record<Lift, boolean>>>(
    {}
  );
  const [dirtyPools, setDirtyPools] = useState<Partial<Record<Lift, boolean>>>(
    {}
  );

  const { poolData, isLoading, saveAuxiliaryPool } = useAuxiliaryPools();

  useEffect(() => {
    if (poolData && !pools) {
      setPools(poolData);
    }
  }, [poolData, pools]);

  async function handleSavePool(lift: Lift) {
    if (!pools) return;
    setSavingPool((prev) => ({ ...prev, [lift]: true }));
    try {
      await saveAuxiliaryPool(lift, pools[lift]);
      setDirtyPools((prev) => ({ ...prev, [lift]: false }));
    } finally {
      setSavingPool((prev) => ({ ...prev, [lift]: false }));
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
        <ScreenTitle>Auxiliary Exercises</ScreenTitle>
        <Text style={styles.subtitle}>
          Reorder to influence future rotation · add custom exercises
        </Text>
      </View>

      {isLoading || !pools ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.blockAssignmentsLink}
            onPress={() => router.push('/settings/aux-block-assignments')}
            activeOpacity={0.7}
          >
            <Text style={styles.blockAssignmentsLinkText}>
              Block Assignments
            </Text>
            <Text style={styles.blockAssignmentsChevron}>›</Text>
          </TouchableOpacity>

          {LIFTS.map((lift) => (
            <LiftSection
              key={lift}
              lift={lift}
              pool={pools[lift]}
              isSavingPool={!!savingPool[lift]}
              isDirtyPool={!!dirtyPools[lift]}
              onPoolChange={(p) => {
                setPools((prev) => (prev ? { ...prev, [lift]: p } : prev));
                setDirtyPools((prev) => ({ ...prev, [lift]: true }));
              }}
              onSavePool={() => handleSavePool(lift)}
              styles={styles}
              primaryColor={colors.primary}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

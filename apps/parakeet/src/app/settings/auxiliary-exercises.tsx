import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '@modules/auth';
import {
  currentBlockNumber,
  getActiveAssignments,
  getActiveProgram,
  getAuxiliaryPools,
  lockAssignment,
  reorderAuxiliaryPool,
  unendingBlockNumber,
} from '@modules/program';
import type { Lift } from '@parakeet/shared-types';
import { getExerciseType } from '@parakeet/training-engine';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackLink } from '../../components/navigation/BackLink';
import { AddExerciseModal } from '../../components/session/AddExerciseModal';
import { MuscleChips } from '../../components/settings/MuscleChips';
import { SlotDropdown } from '../../components/settings/SlotDropdown';
import { qk } from '@platform/query';
import { colors } from '../../theme';

// ── Constants ─────────────────────────────────────────────────────────────────

const LIFTS: Lift[] = ['squat', 'bench', 'deadlift'];

const LIFT_LABELS: Record<Lift, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
};

// ── Pool list ─────────────────────────────────────────────────────────────────

interface PoolListProps {
  pool: string[];
  onReorder: (pool: string[]) => void;
  onRemove: (i: number) => void;
}

function PoolList({ pool, onReorder, onRemove }: PoolListProps) {
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
        <Text style={styles.emptyPoolText}>No exercises in pool — add one below.</Text>
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
              <MuscleChips exerciseName={ex} />
            </View>
            <View style={styles.poolActions}>
              <TouchableOpacity
                style={[styles.reorderBtn, i === 0 && styles.reorderBtnDisabled]}
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
  assignment: [string, string] | null;
  blockNumber: 1 | 2 | 3 | null;
  isSavingPool: boolean;
  isDirtyPool: boolean;
  isSavingAssignment: boolean;
  onPoolChange: (pool: string[]) => void;
  onSavePool: () => void;
  onAssignmentChange: (pair: [string, string]) => void;
  onSaveAssignment: () => void;
}

function LiftSection({
  lift,
  pool,
  assignment,
  blockNumber,
  isSavingPool,
  isDirtyPool,
  isSavingAssignment,
  onPoolChange,
  onSavePool,
  onAssignmentChange,
  onSaveAssignment,
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
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={[styles.saveBtnText, isDirtyPool && styles.saveBtnTextDirty]}>
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
        onConfirm={(name) => { addExercise(name); setPickerVisible(false); }}
        onClose={() => setPickerVisible(false)}
        defaultLift={lift}
        excludeNames={pool}
      />

      {assignment && blockNumber && pool.length >= 2 && (
        <View style={styles.assignmentCard}>
          <View style={styles.assignmentHeader}>
            <Text style={styles.assignmentTitle}>
              Block {blockNumber} Assignment
            </Text>
            <TouchableOpacity
              style={[
                styles.saveAssignmentBtn,
                isSavingAssignment && styles.saveBtnDisabled,
              ]}
              onPress={onSaveAssignment}
              disabled={isSavingAssignment}
              activeOpacity={0.8}
            >
              {isSavingAssignment ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.saveAssignmentBtnText}>Lock</Text>
              )}
            </TouchableOpacity>
          </View>
          <SlotDropdown
            label="Slot 1"
            value={assignment[0]}
            pool={pool}
            onChange={(v) => onAssignmentChange([v, assignment[1]])}
          />
          <SlotDropdown
            label="Slot 2"
            value={assignment[1]}
            pool={pool}
            onChange={(v) => onAssignmentChange([assignment[0], v])}
          />
        </View>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

type Pools = Record<Lift, string[]>;
type Assignments = Record<Lift, [string, string]>;

export default function AuxiliaryExercisesScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pools, setPools] = useState<Pools | null>(null);
  const [assignments, setAssignments] = useState<Partial<Assignments>>({});
  const [blockNumber, setBlockNumber] = useState<1 | 2 | 3 | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [savingPool, setSavingPool] = useState<Partial<Record<Lift, boolean>>>({});
  const [savingAssignment, setSavingAssignment] = useState<Partial<Record<Lift, boolean>>>({});
  const [dirtyPools, setDirtyPools] = useState<Partial<Record<Lift, boolean>>>({});

  const { data: poolData, isLoading } = useQuery({
    queryKey: ['auxiliary', 'pools', user?.id],
    queryFn: () => getAuxiliaryPools(user!.id),
    enabled: !!user?.id,
  });

  const { data: activeProgram } = useQuery({
    queryKey: qk.program.active(user?.id),
    queryFn: () => getActiveProgram(user!.id),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (poolData && !pools) {
      setPools(poolData);
    }
  }, [poolData, pools]);

  useEffect(() => {
    let isMounted = true;

    async function syncAssignmentsFromProgram() {
      if (!activeProgram || !activeProgram.start_date || !user?.id) return;
      let bn: 1 | 2 | 3;
      if (activeProgram.program_mode === 'unending') {
        bn = unendingBlockNumber(
          activeProgram.unending_session_counter ?? 0,
          activeProgram.training_days_per_week ?? 3,
        );
      } else {
        bn = currentBlockNumber(
          activeProgram.start_date,
          activeProgram.total_weeks ?? 9
        );
      }
      setBlockNumber(bn);
      setProgramId(activeProgram.id);
      const loaded = await getActiveAssignments(user.id, activeProgram.id, bn);
      if (!isMounted) return;
      setAssignments(
        Object.fromEntries(
          LIFTS.map((l) => [
            l,
            loaded[l] ?? (pools ? [pools[l][0], pools[l][1]] : ['', '']),
          ])
        ) as Partial<Assignments>
      );
    }

    void syncAssignmentsFromProgram();

    return () => {
      isMounted = false;
    };
  }, [activeProgram, pools, user?.id]);

  async function handleSavePool(lift: Lift) {
    if (!pools || !user) return;
    setSavingPool((prev) => ({ ...prev, [lift]: true }));
    try {
      await reorderAuxiliaryPool(user.id, lift, pools[lift]);
      queryClient.invalidateQueries({ queryKey: ['auxiliary'] });
      setDirtyPools((prev) => ({ ...prev, [lift]: false }));
    } finally {
      setSavingPool((prev) => ({ ...prev, [lift]: false }));
    }
  }

  async function handleSaveAssignment(lift: Lift) {
    if (!user || !programId || !blockNumber || !assignments[lift]) return;
    const [ex1, ex2] = assignments[lift]!;
    setSavingAssignment((prev) => ({ ...prev, [lift]: true }));
    try {
      await lockAssignment(user.id, programId, lift, blockNumber, ex1, ex2);
      queryClient.invalidateQueries({ queryKey: ['auxiliary'] });
    } finally {
      setSavingAssignment((prev) => ({ ...prev, [lift]: false }));
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
        <Text style={styles.title}>Auxiliary Exercises</Text>
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
          {LIFTS.map((lift) => (
            <LiftSection
              key={lift}
              lift={lift}
              pool={pools[lift]}
              assignment={
                (assignments[lift] ?? null) as [string, string] | null
              }
              blockNumber={blockNumber}
              isSavingPool={!!savingPool[lift]}
              isDirtyPool={!!dirtyPools[lift]}
              isSavingAssignment={!!savingAssignment[lift]}
              onPoolChange={(p) => {
                setPools((prev) => (prev ? { ...prev, [lift]: p } : prev));
                setDirtyPools((prev) => ({ ...prev, [lift]: true }));
                // If an assigned exercise was removed from the pool, reset it to a valid entry
                setAssignments((prev) => {
                  const current = prev[lift];
                  if (!current) return prev;
                  const [ex1, ex2] = current;
                  const newEx1 = p.includes(ex1) ? ex1 : (p[0] ?? '');
                  const newEx2 = p.includes(ex2) ? ex2 : (p[1] ?? '');
                  if (newEx1 === ex1 && newEx2 === ex2) return prev;
                  return { ...prev, [lift]: [newEx1, newEx2] };
                });
              }}
              onSavePool={() => handleSavePool(lift)}
              onAssignmentChange={(pair) =>
                setAssignments((prev) => ({ ...prev, [lift]: pair }))
              }
              onSaveAssignment={() => handleSaveAssignment(lift)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bgSurface },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgMuted,
    gap: 2,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
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
  saveBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
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
  bwBadgeText: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
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

  assignmentCard: {
    backgroundColor: colors.primaryMuted,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  assignmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignmentTitle: { fontSize: 13, fontWeight: '600', color: colors.primary },
  saveAssignmentBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  saveAssignmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});

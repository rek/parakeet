import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@modules/auth';
import {
  getActiveProgram,
  getAllBlockAssignments,
  getAuxiliaryPools,
  getCurrentBlock,
  saveBlockAssignment,
} from '@modules/program';
import type { SlotAssignment } from '@modules/program';
import type { Lift } from '@parakeet/shared-types';
import { getAuxiliariesForBlock } from '@parakeet/training-engine';
import { qk } from '@platform/query';
import { BLOCK_INTENSITY } from '@shared/constants/training';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../components/navigation/BackLink';
import { SlotDropdown } from '@modules/formula';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const LIFTS: Lift[] = ['squat', 'bench', 'deadlift'];

const LIFT_LABELS: Record<Lift, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
};

// ── Styles ────────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },

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

    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      gap: 8,
    },
    emptyStateText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    emptyStateSubtext: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: 'center',
    },

    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.bgMuted,
    },
    tab: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 8,
      alignItems: 'center',
      backgroundColor: colors.bgMuted,
    },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: colors.textInverse },

    scroll: { flex: 1 },
    content: { padding: 16, gap: 12, paddingBottom: 48 },

    liftCard: {
      backgroundColor: colors.bgSurface,
      borderRadius: 12,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    liftTitle: { fontSize: 15, fontWeight: '700', color: colors.text },

    slotRow: { gap: 6 },
    slotLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    slotLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    savedFlash: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '600',
      marginRight: 'auto',
      marginLeft: 8,
    },

    autoRow: {
      backgroundColor: colors.bgMuted,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    autoText: {
      fontSize: 14,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
  });
}

type Styles = ReturnType<typeof buildStyles>;

// ── SavedFlash ─────────────────────────────────────────────────────────────────

interface SavedFlashProps {
  visible: boolean;
  styles: Styles;
}

function SavedFlash({ visible, styles }: SavedFlashProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity]);

  return (
    <Animated.Text style={[styles.savedFlash, { opacity }]}>
      Saved
    </Animated.Text>
  );
}

// ── SlotRow ────────────────────────────────────────────────────────────────────

interface SlotRowProps {
  label: string;
  exercise: string;
  locked: boolean;
  autoExercise: string;
  pool: string[];
  saving: boolean;
  savedFlash: boolean;
  onLockToggle: () => void;
  onExerciseChange: (ex: string) => void;
  styles: Styles;
  primaryColor: string;
  textTertiaryColor: string;
}

function SlotRow({
  label,
  exercise,
  locked,
  autoExercise,
  pool,
  saving,
  savedFlash,
  onLockToggle,
  onExerciseChange,
  styles,
  primaryColor,
  textTertiaryColor,
}: SlotRowProps) {
  return (
    <View style={styles.slotRow}>
      <View style={styles.slotLabelRow}>
        <Text style={styles.slotLabel}>{label}</Text>
        <SavedFlash visible={savedFlash} styles={styles} />
        {saving ? (
          <ActivityIndicator size="small" color={primaryColor} />
        ) : (
          <TouchableOpacity
            onPress={onLockToggle}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Ionicons
              name={locked ? 'lock-closed' : 'lock-open-outline'}
              size={16}
              color={locked ? primaryColor : textTertiaryColor}
            />
          </TouchableOpacity>
        )}
      </View>
      {locked ? (
        <SlotDropdown
          label=""
          value={exercise}
          pool={pool}
          onChange={onExerciseChange}
        />
      ) : (
        <View style={styles.autoRow}>
          <Text style={styles.autoText} numberOfLines={1}>
            Auto — {autoExercise}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── LiftCard ───────────────────────────────────────────────────────────────────

interface LiftCardProps {
  lift: Lift;
  assignment: SlotAssignment;
  pool: string[];
  blockNumber: number;
  saving: boolean;
  savedFlash: { slot1: boolean; slot2: boolean };
  onSlotChange: (slot: 1 | 2, exercise: string, locked: boolean) => void;
  styles: Styles;
  primaryColor: string;
  textTertiaryColor: string;
}

function LiftCard({
  lift,
  assignment,
  pool,
  blockNumber,
  saving,
  savedFlash,
  onSlotChange,
  styles,
  primaryColor,
  textTertiaryColor,
}: LiftCardProps) {
  const [auto1, auto2] =
    pool.length >= 2
      ? getAuxiliariesForBlock(lift, blockNumber, pool)
      : ['', ''];

  return (
    <View style={styles.liftCard}>
      <Text style={styles.liftTitle}>{LIFT_LABELS[lift]}</Text>
      <SlotRow
        label="Slot 1"
        exercise={assignment.exercise_1}
        locked={assignment.exercise_1_locked}
        autoExercise={auto1}
        pool={pool}
        saving={saving}
        savedFlash={savedFlash.slot1}
        onLockToggle={() =>
          onSlotChange(1, assignment.exercise_1, !assignment.exercise_1_locked)
        }
        onExerciseChange={(ex) => onSlotChange(1, ex, true)}
        styles={styles}
        primaryColor={primaryColor}
        textTertiaryColor={textTertiaryColor}
      />
      <SlotRow
        label="Slot 2"
        exercise={assignment.exercise_2}
        locked={assignment.exercise_2_locked}
        autoExercise={auto2}
        pool={pool}
        saving={saving}
        savedFlash={savedFlash.slot2}
        onLockToggle={() =>
          onSlotChange(2, assignment.exercise_2, !assignment.exercise_2_locked)
        }
        onExerciseChange={(ex) => onSlotChange(2, ex, true)}
        styles={styles}
        primaryColor={primaryColor}
        textTertiaryColor={textTertiaryColor}
      />
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

type AllAssignments = Record<number, Partial<Record<Lift, SlotAssignment>>>;
type SavingState = Partial<Record<string, boolean>>;
type FlashState = Partial<Record<string, { slot1: boolean; slot2: boolean }>>;

function flashKey(blockNumber: number, lift: Lift) {
  return `${blockNumber}-${lift}`;
}

export default function AuxBlockAssignmentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<number>(1);
  const [programId, setProgramId] = useState<string | null>(null);
  const [isUnending, setIsUnending] = useState(false);
  const [allAssignments, setAllAssignments] = useState<AllAssignments>({});
  const [saving, setSaving] = useState<SavingState>({});
  const [flash, setFlash] = useState<FlashState>({});
  const [initialized, setInitialized] = useState(false);

  const { data: activeProgram } = useQuery({
    queryKey: qk.program.active(user?.id),
    queryFn: () => getActiveProgram(user!.id),
    enabled: !!user?.id,
  });

  const { data: pools, isLoading: poolsLoading } = useQuery({
    queryKey: ['auxiliary', 'pools', user?.id],
    queryFn: () => getAuxiliaryPools(user!.id),
    enabled: !!user?.id,
  });

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!activeProgram || !user?.id) return;

      const unending = activeProgram.program_mode === 'unending';
      setIsUnending(unending);
      setProgramId(activeProgram.id);

      const currentBn = getCurrentBlock(activeProgram);
      setActiveTab(currentBn);

      const loaded = await getAllBlockAssignments(user.id, activeProgram.id);
      if (!isMounted) return;
      setAllAssignments(loaded);
      setInitialized(true);
    }

    void init();
    return () => {
      isMounted = false;
    };
  }, [activeProgram, user?.id]);

  function getAssignmentForBlock(
    blockNumber: number,
    lift: Lift
  ): SlotAssignment {
    const stored = allAssignments[blockNumber]?.[lift];
    if (stored) return stored;
    const pool = pools?.[lift] ?? [];
    const [ex1, ex2] =
      pool.length >= 2
        ? getAuxiliariesForBlock(lift, blockNumber, pool)
        : ['', ''];
    return {
      exercise_1: ex1,
      exercise_1_locked: false,
      exercise_2: ex2,
      exercise_2_locked: false,
    };
  }

  async function handleSlotChange(
    blockNumber: number,
    lift: Lift,
    slot: 1 | 2,
    exercise: string,
    locked: boolean
  ) {
    if (!user || !programId) return;

    const current = getAssignmentForBlock(blockNumber, lift);
    const next: SlotAssignment =
      slot === 1
        ? { ...current, exercise_1: exercise, exercise_1_locked: locked }
        : { ...current, exercise_2: exercise, exercise_2_locked: locked };

    // Optimistic update
    setAllAssignments((prev) => ({
      ...prev,
      [blockNumber]: {
        ...prev[blockNumber],
        [lift]: next,
      },
    }));

    const key = flashKey(blockNumber, lift);
    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await saveBlockAssignment(
        user.id,
        programId,
        lift,
        blockNumber,
        next.exercise_1,
        next.exercise_1_locked,
        next.exercise_2,
        next.exercise_2_locked
      );
      // Trigger flash
      setFlash((prev) => ({
        ...prev,
        [key]:
          slot === 1
            ? { slot1: true, slot2: false }
            : { slot1: false, slot2: true },
      }));
      setTimeout(() => {
        setFlash((prev) => ({
          ...prev,
          [key]: { slot1: false, slot2: false },
        }));
      }, 1200);
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  }

  const isLoading = poolsLoading || !initialized;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
        <Text style={styles.title}>Block Assignments</Text>
        <Text style={styles.subtitle}>
          Lock a slot to pin that exercise · unlocked slots use auto-rotation
        </Text>
      </View>

      {!activeProgram && !isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No active program.</Text>
          <Text style={styles.emptyStateSubtext}>
            Start a program to configure block assignments.
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <>
          {/* Block tabs */}
          <View style={styles.tabs}>
            {([1, 2, 3] as const).map((bn) => {
              const label = isUnending
                ? `Block ${bn} (${BLOCK_INTENSITY[bn]})`
                : `Block ${bn}`;
              return (
                <TouchableOpacity
                  key={bn}
                  style={[styles.tab, activeTab === bn && styles.tabActive]}
                  onPress={() => setActiveTab(bn)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === bn && styles.tabTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {LIFTS.map((lift) => {
              const key = flashKey(activeTab, lift);
              return (
                <LiftCard
                  key={lift}
                  lift={lift}
                  blockNumber={activeTab}
                  assignment={getAssignmentForBlock(activeTab, lift)}
                  pool={pools?.[lift] ?? []}
                  saving={!!saving[key]}
                  savedFlash={flash[key] ?? { slot1: false, slot2: false }}
                  onSlotChange={(slot, exercise, locked) =>
                    void handleSlotChange(
                      activeTab,
                      lift,
                      slot,
                      exercise,
                      locked
                    )
                  }
                  styles={styles}
                  primaryColor={colors.primary}
                  textTertiaryColor={colors.textTertiary}
                />
              );
            })}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { computeEstimated1RM, isLiftValid } from '@modules/onboarding';
import { router } from 'expo-router';

import { ScreenTitle } from '../../../components/ui/ScreenTitle';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

// ── Types ────────────────────────────────────────────────────────────────────

interface LiftState {
  type: '1rm' | '3rm';
  weightKg: string;
  reps: string;
}

interface LiftInput {
  type: '1rm' | '3rm';
  weightKg: number;
  reps?: number;
}

interface LiftsPayload {
  squat: LiftInput;
  bench: LiftInput;
  deadlift: LiftInput;
}

type LiftKey = 'squat' | 'bench' | 'deadlift';

const LIFT_LABELS: Record<LiftKey, string> = {
  squat: 'Squat',
  bench: 'Bench Press',
  deadlift: 'Deadlift',
};

const LIFT_ORDER: LiftKey[] = ['squat', 'bench', 'deadlift'];

// ── Styles ────────────────────────────────────────────────────────────────────

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: colors.bgSurface,
    },
    container: {
      paddingHorizontal: 24,
      paddingTop: 64,
      paddingBottom: 48,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 32,
      lineHeight: 22,
    },
    warningBanner: {
      backgroundColor: colors.warningMuted,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 24,
    },
    warningText: {
      fontSize: 13,
      color: colors.warning,
      lineHeight: 18,
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    toggle: {
      flexDirection: 'row',
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: 'hidden',
    },
    toggleButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: colors.bgSurface,
    },
    toggleButtonLeft: {
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    toggleButtonRight: {},
    toggleButtonActive: {
      backgroundColor: colors.primary,
    },
    toggleButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    toggleButtonTextActive: {
      color: colors.textInverse,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      marginBottom: 10,
    },
    estimated: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    estimatedValue: {
      fontWeight: '600',
      color: colors.text,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryButtonDisabled: {
      opacity: 0.4,
    },
    primaryButtonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '600',
    },
    defaultsLink: {
      marginTop: 20,
      alignItems: 'center',
    },
    defaultsLinkText: {
      fontSize: 14,
      color: colors.textSecondary,
      textDecorationLine: 'underline',
    },
  });
}

type Styles = ReturnType<typeof buildStyles>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDefaultState(): LiftState {
  return { type: '3rm', weightKg: '', reps: '3' };
}

function buildLiftInput(state: LiftState): LiftInput {
  const weight = parseFloat(state.weightKg);
  if (state.type === '1rm') {
    return { type: '1rm', weightKg: weight };
  }
  return { type: '3rm', weightKg: weight, reps: parseInt(state.reps, 10) };
}

// ── Sub-component: single lift section ──────────────────────────────────────

interface LiftSectionProps {
  liftKey: LiftKey;
  state: LiftState;
  onChange: (key: LiftKey, update: Partial<LiftState>) => void;
  styles: Styles;
  textTertiaryColor: string;
}

function LiftSection({
  liftKey,
  state,
  onChange,
  styles,
  textTertiaryColor,
}: LiftSectionProps) {
  const estimated = computeEstimated1RM(state);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{LIFT_LABELS[liftKey]}</Text>

      {/* Segmented toggle: 1RM | 3RM */}
      <View style={styles.toggle}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            styles.toggleButtonLeft,
            state.type === '1rm' && styles.toggleButtonActive,
          ]}
          onPress={() => onChange(liftKey, { type: '1rm' })}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.toggleButtonText,
              state.type === '1rm' && styles.toggleButtonTextActive,
            ]}
          >
            1RM
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            styles.toggleButtonRight,
            state.type === '3rm' && styles.toggleButtonActive,
          ]}
          onPress={() => onChange(liftKey, { type: '3rm' })}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.toggleButtonText,
              state.type === '3rm' && styles.toggleButtonTextActive,
            ]}
          >
            3RM
          </Text>
        </TouchableOpacity>
      </View>

      {/* Weight input */}
      <TextInput
        style={styles.input}
        placeholder="0.0 kg"
        placeholderTextColor={textTertiaryColor}
        value={state.weightKg}
        onChangeText={(v) => onChange(liftKey, { weightKg: v })}
        keyboardType="decimal-pad"
        returnKeyType="done"
      />

      {/* Reps input (3RM only) */}
      {state.type === '3rm' && (
        <TextInput
          style={styles.input}
          placeholder="3"
          placeholderTextColor={textTertiaryColor}
          value={state.reps}
          onChangeText={(v) => onChange(liftKey, { reps: v })}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={2}
        />
      )}

      {/* Estimated 1RM */}
      <Text style={styles.estimated}>
        Est. 1RM: <Text style={styles.estimatedValue}>{estimated}</Text>
      </Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function LiftMaxesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [lifts, setLifts] = useState<Record<LiftKey, LiftState>>({
    squat: makeDefaultState(),
    bench: makeDefaultState(),
    deadlift: makeDefaultState(),
  });
  function handleChange(key: LiftKey, update: Partial<LiftState>) {
    setLifts((prev) => ({ ...prev, [key]: { ...prev[key], ...update } }));
  }

  function handleUseEstimatedStart() {
    router.push({
      pathname: '/(auth)/onboarding/program-settings',
      params: { lifts: '', estimatedStart: '1' },
    });
  }

  const allValid = LIFT_ORDER.every((k) => isLiftValid(lifts[k]));

  function handleNext() {
    if (!allValid) return;

    const payload: LiftsPayload = {
      squat: buildLiftInput(lifts.squat),
      bench: buildLiftInput(lifts.bench),
      deadlift: buildLiftInput(lifts.deadlift),
    };

    router.push({
      pathname: '/(auth)/onboarding/program-settings',
      params: { lifts: JSON.stringify(payload), estimatedStart: '0' },
    });
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenTitle marginBottom={8}>Enter Your Maxes</ScreenTitle>
      <Text style={styles.subtitle}>
        We'll use these to build your first training program.
      </Text>

      {LIFT_ORDER.map((key) => (
        <LiftSection
          key={key}
          liftKey={key}
          state={lifts[key]}
          onChange={handleChange}
          styles={styles}
          textTertiaryColor={colors.textTertiary}
        />
      ))}

      <TouchableOpacity
        style={[
          styles.primaryButton,
          !allValid && styles.primaryButtonDisabled,
        ]}
        onPress={handleNext}
        disabled={!allValid}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Next</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.defaultsLink}
        onPress={handleUseEstimatedStart}
        activeOpacity={0.7}
      >
        <Text style={styles.defaultsLinkText}>I don't know my maxes</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

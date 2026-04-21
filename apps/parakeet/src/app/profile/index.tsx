import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  isValidBirthYear,
  useDeleteBodyweight,
  useProfileEditor,
  useSaveProfile,
} from '@modules/profile';
import type {
  ActivityLevel,
  BiologicalSex,
  BodyweightEntry,
  Goal,
} from '@modules/profile';
import { captureException } from '@platform/utils/captureException';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../components/navigation/BackLink';
import { FormFeedback } from '../../components/ui/FormFeedback';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import { radii, spacing, typography } from '../../theme';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

const GENDER_OPTIONS: { value: BiologicalSex; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
];

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'cut', label: 'Cut' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'bulk', label: 'Bulk' },
];

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[5],
      paddingBottom: spacing[12],
    },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
    },
    fieldBlock: {
      marginBottom: spacing[5],
    },
    fieldBlockLast: {
      marginBottom: 0,
    },
    fieldLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
      marginBottom: spacing[2],
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.bg,
      color: colors.text,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      fontSize: typography.sizes.base,
    },
    inputError: {
      borderColor: colors.danger,
    },
    sexRow: {
      gap: spacing[2],
    },
    pickerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    sectionHeaderWrap: {
      marginTop: spacing[6],
      marginBottom: spacing[3],
    },
    sectionHeader: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
    },
    sectionHint: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      marginTop: spacing[1],
    },
    helperText: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      marginTop: spacing[1],
      fontStyle: 'italic',
    },
    sexOption: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      borderRadius: radii.md,
      paddingVertical: spacing[2.5],
      paddingHorizontal: spacing[3],
    },
    sexOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    sexOptionText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.medium,
    },
    sexOptionTextSelected: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    saveButton: {
      marginTop: spacing[5],
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing[3.5],
      alignItems: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.textInverse,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      letterSpacing: typography.letterSpacing.wide,
    },
    historyCard: {
      marginTop: spacing[6],
      backgroundColor: colors.bgSurface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
    },
    historyTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
      marginBottom: spacing[3],
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[2.5],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    historyDate: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    historyWeight: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginRight: spacing[3],
    },
    historyDelete: {
      fontSize: typography.sizes.xs,
      color: colors.danger,
      fontWeight: typography.weights.medium,
    },
    historyEmpty: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
  });
}

function FieldLabel({
  label,
  styles,
}: {
  label: string;
  styles: ReturnType<typeof buildStyles>;
}) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { profile, bwHistory, isLoading } = useProfileEditor();
  const {
    saveProfile,
    isPending: isSavePending,
  } = useSaveProfile();
  const { deleteEntry } = useDeleteBodyweight();

  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<BiologicalSex | null>(null);
  const [birthYear, setBirthYear] = useState('');
  const [bodyweightKg, setBodyweightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [leanMassKg, setLeanMassKg] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(
    null,
  );
  const [goal, setGoal] = useState<Goal | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? '');
    setGender(profile.biological_sex ?? null);
    setBirthYear(
      profile.date_of_birth
        ? new Date(profile.date_of_birth).getFullYear().toString()
        : ''
    );
    setBodyweightKg(
      profile.bodyweight_kg != null ? profile.bodyweight_kg.toString() : ''
    );
    setHeightCm(profile.height_cm != null ? profile.height_cm.toString() : '');
    setLeanMassKg(
      profile.lean_mass_kg != null ? profile.lean_mass_kg.toString() : '',
    );
    setActivityLevel(profile.activity_level ?? null);
    setGoal(profile.goal ?? null);
  }, [profile]);

  const birthYearIsValid = isValidBirthYear(birthYear);

  const isDirty = useMemo(() => {
    const initialName = profile?.display_name ?? '';
    const initialGender = profile?.biological_sex ?? null;
    const initialBirthYear = profile?.date_of_birth
      ? new Date(profile.date_of_birth).getFullYear().toString()
      : '';
    const initialBodyweight =
      profile?.bodyweight_kg != null ? profile.bodyweight_kg.toString() : '';
    const initialHeight =
      profile?.height_cm != null ? profile.height_cm.toString() : '';
    const initialLeanMass =
      profile?.lean_mass_kg != null ? profile.lean_mass_kg.toString() : '';
    const initialActivity = profile?.activity_level ?? null;
    const initialGoal = profile?.goal ?? null;

    return (
      displayName !== initialName ||
      gender !== initialGender ||
      birthYear !== initialBirthYear ||
      bodyweightKg !== initialBodyweight ||
      heightCm !== initialHeight ||
      leanMassKg !== initialLeanMass ||
      activityLevel !== initialActivity ||
      goal !== initialGoal
    );
  }, [
    profile,
    displayName,
    gender,
    birthYear,
    bodyweightKg,
    heightCm,
    leanMassKg,
    activityLevel,
    goal,
  ]);

  function handleSave() {
    setSaveSuccess(false);
    setSaveError(null);
    if (!birthYearIsValid) {
      setSaveError('Birth year is required and must be 4 digits.');
      return;
    }
    if (!gender) {
      setSaveError('Please select a gender.');
      return;
    }
    saveProfile(
      {
        displayName,
        gender,
        birthYear,
        bodyweightKg,
        heightCm,
        leanMassKg,
        activityLevel,
        goal,
      },
      {
        onSuccess: () => {
          setSaveSuccess(true);
          setSaveError(null);
        },
        onError: () => {
          setSaveSuccess(false);
          setSaveError('Failed to save profile. Please try again.');
        },
      }
    );
  }

  function handleDeleteEntry(entry: BodyweightEntry) {
    Alert.alert(
      'Delete Entry',
      `Remove ${entry.weight_kg} kg from ${formatDate(entry.recorded_date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteEntry({ id: entry.id });
            } catch (err) {
              captureException(err);
            }
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: spacing[10] }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BackLink onPress={() => router.back()} />

        <ScreenTitle marginBottom={spacing[6]}>Edit Profile</ScreenTitle>

        <View style={styles.card}>
          <View style={styles.fieldBlock}>
            <FieldLabel label="Name" styles={styles} />
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Optional"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
              maxLength={40}
            />
          </View>

          <View style={styles.fieldBlock}>
            <FieldLabel label="Gender" styles={styles} />
            <View style={styles.sexRow}>
              {GENDER_OPTIONS.map((option) => {
                const selected = gender === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.sexOption,
                      selected && styles.sexOptionSelected,
                    ]}
                    onPress={() => setGender(option.value)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.sexOptionText,
                        selected && styles.sexOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <FieldLabel label="Birth Year" styles={styles} />
            <TextInput
              style={[styles.input, !birthYearIsValid && styles.inputError]}
              value={birthYear}
              onChangeText={(v) =>
                setBirthYear(v.replace(/\D/g, '').slice(0, 4))
              }
              placeholder="e.g. 1990"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          <View style={styles.fieldBlockLast}>
            <FieldLabel label="Bodyweight (kg)" styles={styles} />
            <TextInput
              style={styles.input}
              value={bodyweightKg}
              onChangeText={setBodyweightKg}
              placeholder="e.g. 82.5"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Body composition & activity — optional; improves macro-target accuracy */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeader}>Body composition & activity</Text>
          <Text style={styles.sectionHint}>
            Optional — improves daily macro-target accuracy.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.fieldBlock}>
            <FieldLabel label="Height (cm)" styles={styles} />
            <TextInput
              style={styles.input}
              value={heightCm}
              onChangeText={setHeightCm}
              placeholder="e.g. 170"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.fieldBlock}>
            <FieldLabel label="Lean mass (kg)" styles={styles} />
            <TextInput
              style={styles.input}
              value={leanMassKg}
              onChangeText={setLeanMassKg}
              placeholder="Optional"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
            <Text style={styles.helperText}>
              DEXA scan preferred. Bioimpedance (smart-scale) readings are
              unreliable on lipedema-affected limbs — leave blank rather than
              guess.
            </Text>
          </View>

          <View style={styles.fieldBlock}>
            <FieldLabel label="Activity level" styles={styles} />
            <View style={styles.pickerRow}>
              {ACTIVITY_OPTIONS.map((option) => {
                const selected = activityLevel === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.sexOption,
                      selected && styles.sexOptionSelected,
                    ]}
                    onPress={() => setActivityLevel(option.value)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.sexOptionText,
                        selected && styles.sexOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldBlockLast}>
            <FieldLabel label="Goal" styles={styles} />
            <View style={styles.pickerRow}>
              {GOAL_OPTIONS.map((option) => {
                const selected = goal === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.sexOption,
                      selected && styles.sexOptionSelected,
                    ]}
                    onPress={() => setGoal(option.value)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.sexOptionText,
                        selected && styles.sexOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <FormFeedback success={saveSuccess} error={saveError} />

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!isDirty || !birthYearIsValid || !gender || isSavePending) &&
              styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!isDirty || !birthYearIsValid || !gender || isSavePending}
          activeOpacity={0.8}
        >
          {isSavePending ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Bodyweight History */}
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Bodyweight History</Text>
          {!bwHistory || bwHistory.length === 0 ? (
            <Text style={styles.historyEmpty}>No entries yet.</Text>
          ) : (
            bwHistory.map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <Text style={styles.historyDate}>
                  {formatDate(entry.recorded_date)}
                </Text>
                <Text style={styles.historyWeight}>{entry.weight_kg} kg</Text>
                <TouchableOpacity
                  onPress={() => handleDeleteEntry(entry)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.historyDelete}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

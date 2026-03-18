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
  addBodyweightEntry,
  birthYearToDobIso,
  deleteBodyweightEntry,
  getBodyweightHistory,
  getProfile,
  isValidBirthYear,
  updateProfile,
} from '@modules/profile';
import type { BiologicalSex, BodyweightEntry } from '@modules/profile';
import { qk } from '@platform/query';
import { captureException } from '@platform/utils/captureException';
import { useAuth } from '@modules/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    staleTime: 5 * 60 * 1000,
  });

  const { data: bwHistory } = useQuery({
    queryKey: qk.bodyweight.history(user?.id),
    queryFn: getBodyweightHistory,
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<BiologicalSex | null>(null);
  const [birthYear, setBirthYear] = useState('');
  const [bodyweightKg, setBodyweightKg] = useState('');
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

    return (
      displayName !== initialName ||
      gender !== initialGender ||
      birthYear !== initialBirthYear ||
      bodyweightKg !== initialBodyweight
    );
  }, [profile, displayName, gender, birthYear, bodyweightKg]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dobIso = birthYearToDobIso(birthYear);

      const parsedBodyweight = bodyweightKg.trim()
        ? parseFloat(bodyweightKg)
        : null;

      const validBodyweight =
        parsedBodyweight != null && !isNaN(parsedBodyweight)
          ? parsedBodyweight
          : null;

      await updateProfile({
        display_name: displayName.trim() ? displayName.trim() : null,
        biological_sex: gender,
        date_of_birth: dobIso,
        bodyweight_kg: validBodyweight,
      });

      // Record bodyweight history entry when value is present
      if (validBodyweight != null) {
        await addBodyweightEntry({
          recordedDate: todayIso(),
          weightKg: validBodyweight,
        });
      }
    },
    onSuccess: async () => {
      setSaveSuccess(true);
      setSaveError(null);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({
        queryKey: qk.bodyweight.history(user?.id),
      });
      await queryClient.invalidateQueries({
        queryKey: ['achievements', 'wilks-current'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['achievements', 'wilks-history'],
      });
    },
    onError: () => {
      setSaveSuccess(false);
      setSaveError('Failed to save profile. Please try again.');
    },
  });

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
    saveMutation.mutate();
  }

  async function handleDeleteEntry(entry: BodyweightEntry) {
    Alert.alert(
      'Delete Entry',
      `Remove ${entry.weight_kg} kg from ${formatDate(entry.recorded_date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBodyweightEntry(entry.id);
              await queryClient.invalidateQueries({
                queryKey: qk.bodyweight.history(user?.id),
              });
              await queryClient.invalidateQueries({ queryKey: ['profile'] });
              await queryClient.invalidateQueries({
                queryKey: ['achievements', 'wilks-current'],
              });
              await queryClient.invalidateQueries({
                queryKey: ['achievements', 'wilks-history'],
              });
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

        <FormFeedback success={saveSuccess} error={saveError} />

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!isDirty ||
              !birthYearIsValid ||
              !gender ||
              saveMutation.isPending) &&
              styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={
            !isDirty || !birthYearIsValid || !gender || saveMutation.isPending
          }
          activeOpacity={0.8}
        >
          {saveMutation.isPending ? (
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
                <Text style={styles.historyWeight}>
                  {entry.weight_kg} kg
                </Text>
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

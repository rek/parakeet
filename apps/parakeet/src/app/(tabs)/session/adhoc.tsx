import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '@modules/auth';
import { createAdHocSession } from '@modules/session';
import { captureException } from '@platform/utils/captureException';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackLink } from '../../../components/navigation/BackLink';
import { colors, radii, spacing, typography } from '../../../theme';

type Lift = 'squat' | 'bench' | 'deadlift';
type Intensity = 'heavy' | 'explosive' | 'rep';

const LIFTS: { value: Lift; label: string }[] = [
  { value: 'squat', label: 'Squat' },
  { value: 'bench', label: 'Bench' },
  { value: 'deadlift', label: 'Deadlift' },
];

const INTENSITIES: { value: Intensity; label: string; description: string }[] = [
  { value: 'heavy', label: 'Heavy', description: 'Low reps, high load' },
  { value: 'explosive', label: 'Explosive', description: 'Moderate load, speed focus' },
  { value: 'rep', label: 'Rep', description: 'Higher reps, moderate load' },
];

export default function AdHocScreen() {
  const { user } = useAuth();
  const [lift, setLift] = useState<Lift>('squat');
  const [intensity, setIntensity] = useState<Intensity>('heavy');
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    if (!user) return;
    setLoading(true);
    try {
      const sessionId = await createAdHocSession(user.id, lift, intensity);
      router.replace({
        pathname: '/session/soreness',
        params: { sessionId },
      });
    } catch (err) {
      captureException(err);
      Alert.alert('Error', 'Could not create session — try again.');
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Ad-Hoc Workout</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>Lift</Text>
        <View style={styles.optionRow}>
          {LIFTS.map((l) => (
            <TouchableOpacity
              key={l.value}
              style={[styles.optionButton, lift === l.value && styles.optionButtonActive]}
              onPress={() => setLift(l.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionButtonText, lift === l.value && styles.optionButtonTextActive]}>
                {l.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: spacing[6] }]}>Intensity</Text>
        <View style={styles.intensityList}>
          {INTENSITIES.map((i) => (
            <TouchableOpacity
              key={i.value}
              style={[styles.intensityButton, intensity === i.value && styles.intensityButtonActive]}
              onPress={() => setIntensity(i.value)}
              activeOpacity={0.7}
            >
              <View style={styles.intensityButtonInner}>
                <Text style={[styles.intensityLabel, intensity === i.value && styles.intensityLabelActive]}>
                  {i.label}
                </Text>
                <Text style={[styles.intensityDesc, intensity === i.value && styles.intensityDescActive]}>
                  {i.description}
                </Text>
              </View>
              {intensity === i.value && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.startButton, loading && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={styles.startButtonText}>Start Workout →</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgSurface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 80,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
  },
  sectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
    marginBottom: spacing[3],
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  optionButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
  },
  optionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  optionButtonTextActive: {
    color: colors.textInverse,
  },
  intensityList: {
    gap: spacing[2],
  },
  intensityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  intensityButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  intensityButtonInner: {
    flex: 1,
  },
  intensityLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing[0.5],
  },
  intensityLabelActive: {
    color: colors.primary,
  },
  intensityDesc: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  intensityDescActive: {
    color: colors.primary,
    opacity: 0.7,
  },
  checkmark: {
    fontSize: typography.sizes.base,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  startButton: {
    marginTop: spacing[8],
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
    letterSpacing: typography.letterSpacing.wide,
  },
});

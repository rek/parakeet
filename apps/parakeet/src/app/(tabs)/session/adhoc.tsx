import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@modules/auth';
import { createAdHocSession, startSession } from '@modules/session';
import { captureException } from '@platform/utils/captureException';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../../components/navigation/BackLink';
import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
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
    nameInput: {
      fontSize: typography.sizes.base,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      backgroundColor: colors.bgSurface,
    },
    hint: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      marginTop: spacing[3],
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
}

export default function AdHocScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [activityName, setActivityName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    if (!user) return;
    setLoading(true);
    try {
      const name = activityName.trim() || 'Ad-Hoc Workout';
      const sessionId = await createAdHocSession(user.id, {
        activityName: name,
      });
      // Start immediately — no soreness/JIT for free-form
      await startSession(sessionId);
      router.replace({
        pathname: '/session/[sessionId]',
        params: { sessionId, freeForm: '1' },
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
        <Text style={styles.sectionLabel}>Activity Name</Text>
        <TextInput
          style={styles.nameInput}
          value={activityName}
          onChangeText={setActivityName}
          placeholder="e.g. Kettlebell swings, Burpees"
          placeholderTextColor={colors.textTertiary}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleStart}
        />

        <Text style={styles.hint}>
          Start your workout, then add exercises as you go.
        </Text>

        <TouchableOpacity
          style={[styles.startButton, loading && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={styles.startButtonText}>Start Workout</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

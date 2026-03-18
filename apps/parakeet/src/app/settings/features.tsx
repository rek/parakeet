import { useCallback, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  FEATURE_CATEGORIES,
  FEATURE_REGISTRY,
  FULL_PRESET,
  SIMPLE_PRESET,
  useFeatureFlags,
} from '@modules/feature-flags';
import type { FeatureCategory, FeatureId } from '@modules/feature-flags';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../components/navigation/BackLink';
import { ScreenTitle } from '../../components/ui/ScreenTitle';
import { radii, spacing, typography } from '../../theme';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

function isPresetMatch(
  flags: Record<FeatureId, boolean>,
  preset: Record<FeatureId, boolean>
) {
  return (Object.keys(preset) as FeatureId[]).every(
    (id) => flags[id] === preset[id]
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollView: {
      flex: 1,
    },
    container: {
      paddingHorizontal: spacing[6],
      paddingTop: spacing[4],
      paddingBottom: spacing[12],
    },
    subtitle: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing[5],
      lineHeight: 20,
    },
    presetRow: {
      flexDirection: 'row',
      gap: spacing[2],
      marginBottom: spacing[6],
    },
    presetBtn: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgMuted,
    },
    presetBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    presetBtnCustom: {
      borderColor: colors.textTertiary,
      backgroundColor: 'transparent',
    },
    presetBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    presetBtnTextActive: {
      color: colors.primary,
    },
    presetBtnTextCustom: {
      color: colors.textTertiary,
    },
    sectionHeader: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.widest,
      marginBottom: spacing[1],
      marginTop: spacing[4],
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    featureInfo: {
      flex: 1,
      marginRight: spacing[3],
    },
    featureLabel: {
      fontSize: typography.sizes.base,
      color: colors.text,
      fontWeight: typography.weights.medium,
    },
    featureDesc: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
      marginTop: 2,
      lineHeight: 16,
    },
  });
}

export default function FeaturesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { flags, toggle, applyPreset } = useFeatureFlags();

  const activePreset = isPresetMatch(flags, SIMPLE_PRESET)
    ? 'simple'
    : isPresetMatch(flags, FULL_PRESET)
      ? 'full'
      : 'custom';

  const handlePreset = useCallback(
    async (preset: 'simple' | 'full') => {
      await applyPreset(preset === 'simple' ? SIMPLE_PRESET : FULL_PRESET);
    },
    [applyPreset]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <BackLink label="Settings" onPress={() => router.back()} />

        <ScreenTitle marginBottom={spacing[1]}>Features</ScreenTitle>
        <Text style={styles.subtitle}>
          Toggle features to keep your app simple or unlock everything.
        </Text>

        {/* Presets */}
        <View style={styles.presetRow}>
          {(['simple', 'full'] as const).map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[
                styles.presetBtn,
                activePreset === preset && styles.presetBtnActive,
              ]}
              onPress={() => handlePreset(preset)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.presetBtnText,
                  activePreset === preset && styles.presetBtnTextActive,
                ]}
              >
                {preset === 'simple' ? 'Simple' : 'Full'}
              </Text>
            </TouchableOpacity>
          ))}
          {activePreset === 'custom' && (
            <View style={[styles.presetBtn, styles.presetBtnCustom]}>
              <Text style={[styles.presetBtnText, styles.presetBtnTextCustom]}>
                Custom
              </Text>
            </View>
          )}
        </View>

        {/* Feature toggles by category */}
        {FEATURE_CATEGORIES.map((cat) => {
          const features = FEATURE_REGISTRY.filter(
            (f) => f.category === (cat.id as FeatureCategory)
          );
          return (
            <View key={cat.id}>
              <Text style={styles.sectionHeader}>{cat.label}</Text>
              {features.map((feature) => (
                <View key={feature.id} style={styles.featureRow}>
                  <View style={styles.featureInfo}>
                    <Text style={styles.featureLabel}>{feature.label}</Text>
                    <Text style={styles.featureDesc}>
                      {feature.description}
                    </Text>
                  </View>
                  <Switch
                    value={flags[feature.id]}
                    onValueChange={(val) =>
                      toggle({ id: feature.id, enabled: val })
                    }
                    trackColor={{
                      false: colors.bgMuted,
                      true: colors.primaryMuted,
                    }}
                    thumbColor={
                      flags[feature.id] ? colors.primary : colors.textTertiary
                    }
                  />
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

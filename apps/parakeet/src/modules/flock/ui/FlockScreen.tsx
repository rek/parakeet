// @spec docs/features/flock/spec-ui.md
import { useMemo } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useFlock } from '../hooks/useFlock';
import { useFlockSharing } from '../hooks/useFlockSharing';
import { FlockCard } from './FlockCard';

export function FlockScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { data, isLoading, isRefetching, refetch } = useFlock();
  const { sharingEnabled, setSharing, isUpdating } = useFlockSharing();

  const cards = data ?? [];

  return (
    <View style={styles.root}>
      <FlatList
        data={cards}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => <FlockCard card={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <ShareBanner
            enabled={sharingEnabled}
            disabled={isUpdating}
            onToggle={setSharing}
            styles={styles}
            colors={colors}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <Text style={styles.empty}>
              No highlights yet. When your flock trains, their PRs show up here.
            </Text>
          )
        }
      />
    </View>
  );
}

function ShareBanner({
  enabled,
  disabled,
  onToggle,
  styles,
  colors,
}: {
  enabled: boolean;
  disabled: boolean;
  onToggle: (value: boolean) => void;
  styles: ReturnType<typeof buildStyles>;
  colors: ColorScheme;
}) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerRow}>
        <Text style={styles.bannerTitle}>
          {enabled ? "You're sharing" : 'Share your highlights'}
        </Text>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>
      <Text style={styles.bannerBody}>
        {enabled
          ? 'Your PRs, Wilks, and streaks appear on your flock’s feed. Turn off any time to remove your card.'
          : 'Show your PRs, Wilks, and streaks to the flock. Never your logged weights, RPE, or any health data.'}
      </Text>
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    list: { padding: spacing[4], gap: 0 },
    sep: { height: spacing[3] },
    banner: {
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
      gap: spacing[2],
      marginBottom: spacing[4],
    },
    bannerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bannerTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    bannerBody: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    empty: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      textAlign: 'center',
      paddingVertical: spacing[6],
    },
  });
}

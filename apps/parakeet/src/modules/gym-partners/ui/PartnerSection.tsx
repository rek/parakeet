// @spec docs/features/social/spec-session-visibility.md
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useFeatureEnabled } from '@modules/feature-flags';
import { router } from 'expo-router';

import type { ColorScheme } from '../../../theme';
import { spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import type { PartnerWithSession } from '../hooks/usePartnerSessions';
import { usePartnerSessions } from '../hooks/usePartnerSessions';
import { usePartnerVideoBadge } from '../hooks/usePartnerVideoBadge';
import { PartnerCard } from './PartnerCard';
import { PartnerFilmingSheet } from './PartnerFilmingSheet';
import { QrGenerateSheet } from './QrGenerateSheet';

export function PartnerSection() {
  const enabled = useFeatureEnabled('gymPartner');
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { partners, pendingRequests, isLoading } = usePartnerSessions();
  const { count: unseenVideoCount, markAsSeen } = usePartnerVideoBadge();
  const [showQr, setShowQr] = useState(false);
  const [filmTarget, setFilmTarget] = useState<PartnerWithSession | null>(null);

  if (!enabled) return null;
  if (isLoading) return null;

  const pendingCount = pendingRequests.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (unseenVideoCount > 0) markAsSeen();
            router.push('/settings/gym-partners');
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>GYM PARTNERS</Text>
            {pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount} pending</Text>
              </View>
            )}
            {unseenVideoCount > 0 && (
              <View style={styles.videoBadge}>
                <Text style={styles.videoBadgeText}>{unseenVideoCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowQr(true)}
          hitSlop={8}
          accessibilityLabel="Add partner"
          accessibilityRole="button"
        >
          <Text style={styles.addButton}>+</Text>
        </TouchableOpacity>
      </View>

      {partners.length === 0 ? (
        <TouchableOpacity
          style={styles.emptyState}
          onPress={() => router.push('/settings/gym-partners')}
          activeOpacity={0.7}
        >
          <Text style={styles.emptyText}>
            Add a gym partner to{'\n'}film each other's lifts
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.cards}>
          {partners.map((partner) => (
            <PartnerCard
              key={partner.id}
              partner={partner}
              onFilm={() => setFilmTarget(partner)}
            />
          ))}
        </View>
      )}

      <QrGenerateSheet visible={showQr} onClose={() => setShowQr(false)} />

      {filmTarget?.activeSession && (
        <PartnerFilmingSheet
          visible={filmTarget !== null}
          onClose={() => setFilmTarget(null)}
          partnerId={filmTarget.partnerId}
          partnerName={filmTarget.partnerName}
          sessionId={filmTarget.activeSession.id}
          lift={filmTarget.activeSession.primaryLift ?? ''}
          plannedSets={filmTarget.activeSession.plannedSets ?? []}
        />
      )}
    </View>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      gap: spacing[3],
      marginTop: spacing[6],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    headerTitle: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    badge: {
      paddingHorizontal: spacing[2],
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: colors.primaryMuted,
    },
    badgeText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    videoBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    videoBadgeText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.textInverse,
    },
    addButton: {
      fontSize: typography.sizes.xl,
      color: colors.primary,
      fontWeight: typography.weights.bold,
      lineHeight: typography.sizes['2xl'],
    },
    cards: {
      gap: spacing[2],
    },
    emptyState: {
      paddingVertical: spacing[4],
      alignItems: 'center',
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
}

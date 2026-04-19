import { useMemo } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { extractSources, type SourceLink } from '../lib/extract-sources';

export function SourcesSection({ descriptionMd }: { descriptionMd: string | null }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const sources = useMemo(() => extractSources(descriptionMd), [descriptionMd]);

  if (sources.length === 0) {
    return (
      <Text style={styles.empty}>
        No sources listed in this protocol's prose yet.
      </Text>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        {sources.length} source{sources.length === 1 ? '' : 's'} referenced
        in the protocol prose. Tap to open.
      </Text>
      {sources.map((s, i) => (
        <SourceCard key={s.url} index={i + 1} source={s} styles={styles} />
      ))}
    </View>
  );
}

function SourceCard({
  index,
  source,
  styles,
}: {
  index: number;
  source: SourceLink;
  styles: ReturnType<typeof buildStyles>;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() => {
        Linking.openURL(source.url).catch(() => {});
      }}
    >
      <Text style={styles.index}>{String(index).padStart(2, '0')}</Text>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {source.title}
        </Text>
        <Text style={styles.url} numberOfLines={1}>
          {hostname(source.url)}
        </Text>
      </View>
      <Ionicons
        name="open-outline"
        size={18}
        color={colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

function hostname(url: string): string {
  const m = url.match(/^https?:\/\/([^/]+)/);
  return m ? m[1] : url;
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    root: { gap: spacing[2] },
    intro: {
      fontSize: typography.sizes.sm,
      color: colors.textTertiary,
      fontStyle: 'italic',
      marginBottom: spacing[2],
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      backgroundColor: colors.bgSurface,
      borderRadius: radii.md,
      padding: spacing[3],
    },
    index: {
      fontFamily: 'Courier',
      fontSize: typography.sizes.sm,
      color: colors.primary,
      fontWeight: typography.weights.bold,
    },
    body: { flex: 1, gap: 2 },
    title: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      lineHeight: typography.sizes.sm * 1.4,
    },
    url: {
      fontSize: typography.sizes.xs,
      color: colors.textTertiary,
    },
    empty: {
      color: colors.textTertiary,
      fontSize: typography.sizes.sm,
      fontStyle: 'italic',
    },
  });
}

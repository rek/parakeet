import { useMemo } from 'react';
import { Linking, StyleSheet } from 'react-native';
import MarkdownDisplay from 'react-native-markdown-display';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';

/**
 * Thin wrapper around react-native-markdown-display, styled to match the
 * Parakeet theme. Supports everything standard markdown can do: nested
 * lists, inline formatting, links, tables, blockquotes, code blocks.
 */
export function Markdown({ source }: { source: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  return (
    <MarkdownDisplay
      style={styles}
      onLinkPress={(url) => {
        Linking.openURL(url).catch(() => {});
        return false;
      }}
    >
      {source}
    </MarkdownDisplay>
  );
}

function buildStyles(colors: ColorScheme) {
  const body = {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    lineHeight: typography.sizes.base * 1.5,
  } as const;

  return StyleSheet.create({
    body,
    heading1: {
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weights.black,
      color: colors.text,
      marginTop: spacing[3],
      marginBottom: spacing[2],
    },
    heading2: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginTop: spacing[4],
      marginBottom: spacing[2],
    },
    heading3: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginTop: spacing[3],
      marginBottom: spacing[1],
    },
    heading4: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginTop: spacing[2],
    },
    paragraph: {
      ...body,
      marginTop: 0,
      marginBottom: spacing[3],
    },
    strong: { fontWeight: typography.weights.bold, color: colors.text },
    em: { fontStyle: 'italic' },
    link: {
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    blockquote: {
      backgroundColor: colors.bgSurface,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      marginVertical: spacing[2],
    },
    bullet_list: { marginVertical: spacing[1] },
    ordered_list: { marginVertical: spacing[1] },
    list_item: { marginBottom: spacing[1] },
    bullet_list_icon: {
      color: colors.textTertiary,
      marginRight: spacing[2],
      marginLeft: 0,
      marginTop: body.lineHeight / 2 - 3,
    },
    bullet_list_content: { ...body, flex: 1 },
    ordered_list_icon: {
      color: colors.textTertiary,
      marginRight: spacing[2],
      marginLeft: 0,
    },
    ordered_list_content: { ...body, flex: 1 },
    code_inline: {
      fontFamily: 'Courier',
      fontSize: typography.sizes.sm,
      color: colors.primary,
      backgroundColor: colors.bgSurface,
      borderRadius: radii.xs,
      paddingHorizontal: 4,
    },
    code_block: {
      fontFamily: 'Courier',
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      backgroundColor: colors.bgSurface,
      borderRadius: radii.sm,
      padding: spacing[3],
      marginVertical: spacing[2],
    },
    fence: {
      fontFamily: 'Courier',
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      backgroundColor: colors.bgSurface,
      borderRadius: radii.sm,
      padding: spacing[3],
      marginVertical: spacing[2],
      borderWidth: 1,
      borderColor: colors.border,
    },
    hr: {
      backgroundColor: colors.border,
      height: StyleSheet.hairlineWidth,
      marginVertical: spacing[3],
    },
    table: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      marginVertical: spacing[2],
      overflow: 'hidden',
    },
    thead: {
      backgroundColor: colors.bgSurface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tbody: {},
    th: {
      flex: 1,
      padding: spacing[2],
      borderRightWidth: 1,
      borderRightColor: colors.border,
      color: colors.text,
    },
    tr: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
    },
    td: {
      flex: 1,
      padding: spacing[2],
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
  });
}

import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { RepVerdict } from '@parakeet/shared-types';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';

const VERDICT_CONFIG = {
  white_light: { symbol: '\u2713', label: 'Pass' },
  borderline: { symbol: '~', label: 'Borderline' },
  red_light: { symbol: '\u2717', label: 'Fail' },
} as const;

function verdictColor(verdict: RepVerdict['verdict'], colors: ColorScheme) {
  if (verdict === 'white_light') return colors.success;
  if (verdict === 'borderline') return colors.warning;
  return colors.danger;
}

/**
 * Compact verdict badge for a single rep. Shows pass/fail/borderline icon.
 * Tap to expand and see individual criterion results.
 */
export function VerdictBadge({
  verdict,
  colors,
  inline,
}: {
  verdict: RepVerdict;
  colors: ColorScheme;
  inline?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = VERDICT_CONFIG[verdict.verdict];
  const color = verdictColor(verdict.verdict, colors);

  return (
    <View style={inline ? undefined : styles.container}>
      <TouchableOpacity
        style={[
          styles.badge,
          { borderColor: color + '40', backgroundColor: color + '10' },
        ]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        accessible
        accessibilityLabel={`Competition verdict: ${config.label}`}
        accessibilityRole="button"
      >
        <Text style={[styles.symbol, { color }]}>{config.symbol}</Text>
        <Text style={[styles.label, { color }]}>{config.label}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.details, { borderColor: colors.border }]}>
          {verdict.criteria.map((c) => (
            <View key={c.name} style={styles.criterionRow}>
              <Text
                style={[
                  styles.criterionSymbol,
                  {
                    color: verdictColor(
                      c.verdict === 'pass'
                        ? 'white_light'
                        : c.verdict === 'fail'
                          ? 'red_light'
                          : 'borderline',
                      colors
                    ),
                  },
                ]}
              >
                {c.verdict === 'pass'
                  ? '\u2713'
                  : c.verdict === 'fail'
                    ? '\u2717'
                    : '~'}
              </Text>
              <Text style={[styles.criterionMessage, { color: colors.text }]}>
                {c.message}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[1],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  symbol: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  details: {
    marginTop: spacing[1],
    paddingLeft: spacing[3],
    borderLeftWidth: 2,
    gap: spacing[1],
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  criterionSymbol: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    width: 14,
  },
  criterionMessage: {
    flex: 1,
    fontSize: typography.sizes.xs,
    lineHeight: 16,
  },
});

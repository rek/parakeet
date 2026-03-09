import { colors as defaultColors, type ColorScheme } from '../../../theme'

export type TrendDirection = 'improving' | 'stable' | 'declining'

export const TREND_CONFIG: Record<TrendDirection, { symbol: string; color: string }> = {
  improving: { symbol: '\u2191', color: defaultColors.success },
  stable:    { symbol: '\u2192', color: defaultColors.textSecondary },
  declining: { symbol: '\u2193', color: defaultColors.danger },
}

export function getTrendConfig(colors: ColorScheme): Record<TrendDirection, { symbol: string; color: string }> {
  return {
    improving: { symbol: '\u2191', color: colors.success },
    stable:    { symbol: '\u2192', color: colors.textSecondary },
    declining: { symbol: '\u2193', color: colors.danger },
  }
}

import { colors } from '../../../theme'

export type TrendDirection = 'improving' | 'stable' | 'declining'

export const TREND_CONFIG: Record<TrendDirection, { symbol: string; color: string }> = {
  improving: { symbol: '\u2191', color: colors.success },
  stable:    { symbol: '\u2192', color: colors.textSecondary },
  declining: { symbol: '\u2193', color: colors.danger },
}

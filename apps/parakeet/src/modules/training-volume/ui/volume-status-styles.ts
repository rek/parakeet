import type { VolumeStatus } from '@parakeet/training-engine';

/** Map VolumeStatus to a theme color key. Consumers call with their ColorScheme. */
export function getVolumeStatusColor(
  status: VolumeStatus,
  colors: { info: string; success: string; warning: string; danger: string }
): string {
  switch (status) {
    case 'below_mev':
      return colors.info;
    case 'in_range':
      return colors.success;
    case 'approaching_mrv':
      return colors.warning;
    case 'at_mrv':
      return colors.danger;
    case 'exceeded_mrv':
      return colors.danger;
    default:
      return colors.info;
  }
}

export function isVolumeOverMrv(status: VolumeStatus): boolean {
  return status === 'at_mrv' || status === 'exceeded_mrv';
}

/** Volume bar fill percentage: (sets / mrv) × 100, clamped to [0,100]. */
export function volumeFillPct(sets: number, mrv: number): number {
  return mrv > 0 ? Math.min(100, (sets / mrv) * 100) : 0;
}

/**
 * Color for a volume bar based on fill ratio (0–1 scale, used in weekly-review).
 * Thresholds: >=1.0 danger, >=0.85 warning, >=0.5 success, else info.
 */
export function volumeBarColor(
  pct: number,
  colors: { danger: string; warning: string; success: string; info: string }
): string {
  if (pct >= 1.0) return colors.danger;
  if (pct >= 0.85) return colors.warning;
  if (pct >= 0.5) return colors.success;
  return colors.info;
}

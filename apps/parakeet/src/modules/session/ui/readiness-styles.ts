export function getReadinessPillColors(colors: {
  warning: string;
  danger: string;
  textSecondary: string;
  success: string;
  warningMuted: string;
  dangerMuted: string;
  bgMuted: string;
  successMuted: string;
}) {
  return {
    text: {
      1: colors.danger,
      2: colors.warning,
      3: colors.textSecondary,
      4: colors.success,
      5: colors.success,
    } as Record<number, string>,
    bg: {
      1: colors.dangerMuted,
      2: colors.warningMuted,
      3: colors.bgMuted,
      4: colors.successMuted,
      5: colors.successMuted,
    } as Record<number, string>,
  };
}

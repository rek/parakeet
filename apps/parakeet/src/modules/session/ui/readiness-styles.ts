export function getReadinessPillColors(colors: {
  warning: string;
  textSecondary: string;
  success: string;
  warningMuted: string;
  bgMuted: string;
  successMuted: string;
}) {
  return {
    text: {
      1: colors.warning,
      2: colors.textSecondary,
      3: colors.success,
    } as Record<number, string>,
    bg: {
      1: colors.warningMuted,
      2: colors.bgMuted,
      3: colors.successMuted,
    } as Record<number, string>,
  };
}

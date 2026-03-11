export const PERFORMANCE_LABELS: Record<string, string> = {
  over: 'Above plan',
  at: 'On plan',
  under: 'Below plan',
  incomplete: 'Incomplete',
};

export function getPerformanceColors(colors: {
  success: string;
  warning: string;
  danger: string;
}): Record<string, string> {
  return {
    over: colors.success,
    at: colors.success,
    under: colors.warning,
    incomplete: colors.danger,
  };
}

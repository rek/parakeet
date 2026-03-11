// ── Types ─────────────────────────────────────────────────────────────────────

type ProgressRating = 'excellent' | 'good' | 'stalled' | 'concerning';

interface RatingColors {
  successMuted: string;
  success: string;
  infoMuted: string;
  info: string;
  warningMuted: string;
  warning: string;
  dangerMuted: string;
  danger: string;
}

// ── Functions ─────────────────────────────────────────────────────────────────

export function getRatingStyles(
  colors: RatingColors
): Record<ProgressRating, { bg: string; text: string; label: string }> {
  return {
    excellent:  { bg: colors.successMuted, text: colors.success,  label: 'Excellent'  },
    good:       { bg: colors.infoMuted,    text: colors.info,     label: 'Good'       },
    stalled:    { bg: colors.warningMuted, text: colors.warning,  label: 'Stalled'    },
    concerning: { bg: colors.dangerMuted,  text: colors.danger,   label: 'Concerning' },
  };
}

export function getVolumeLevelColors(colors: {
  danger: string;
  warning: string;
  success: string;
  bgMuted: string;
}): Record<'exceeded' | 'approaching' | 'in_range' | 'below', string> {
  return {
    exceeded:   colors.danger,
    approaching: colors.warning,
    in_range:   colors.success,
    below:      colors.bgMuted,
  };
}

export function getSeverityPalette(colors: {
  warningMuted: string
  warning: string
  secondaryMuted: string
  secondary: string
  dangerMuted: string
  danger: string
}) {
  return {
    minor:    { bg: colors.warningMuted,   border: colors.warning,   text: colors.warning },
    moderate: { bg: colors.secondaryMuted, border: colors.secondary, text: colors.warning },
    major:    { bg: colors.dangerMuted,    border: colors.danger,    text: colors.danger },
  }
}

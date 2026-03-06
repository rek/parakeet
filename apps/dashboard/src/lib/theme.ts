/**
 * Typed references to CSS custom properties defined in styles.css.
 * Use these in inline styles instead of raw rgba/hex literals.
 */
export const theme = {
  color: {
    accent: 'var(--accent)',
    blue: 'var(--blue)',
    green: 'var(--green)',
    red: 'var(--red)',
    purple: 'var(--purple)',
    text: 'var(--text)',
    textBright: 'var(--text-bright)',
    textDim: 'var(--text-dim)',
    textMuted: 'var(--text-muted)',
  },
  bg: {
    base: 'var(--bg)',
    surface: 'var(--surface)',
    surfaceRaised: 'var(--surface-raised)',
    surfaceHover: 'var(--surface-hover)',
    accentDim: 'var(--accent-dim)',
    blueDim: 'var(--blue-dim)',
    greenDim: 'var(--green-dim)',
    redDim: 'var(--red-dim)',
    purpleDim: 'var(--purple-dim)',
    purpleSubtle: 'var(--purple-subtle)',
    surfaceOverlay: 'var(--surface-overlay)',
  },
  border: {
    base: 'var(--border)',
    light: 'var(--border-light)',
    accent: 'var(--accent-border)',
    accentStrong: 'var(--accent-border-strong)',
    blue: 'var(--blue-border)',
    blueLight: 'var(--blue-border-light)',
    green: 'var(--green-border)',
    red: 'var(--red-border)',
    purple: 'var(--purple-border)',
    purpleLight: 'var(--purple-border-light)',
    purpleStrong: 'var(--purple-border-strong)',
  },
  font: {
    mono: 'var(--mono)',
    sans: 'var(--sans)',
  },
} as const;

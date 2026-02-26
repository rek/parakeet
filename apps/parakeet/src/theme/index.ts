/**
 * Parakeet Design System — centralized design tokens.
 *
 * USAGE:  import { colors, spacing, radii, typography, shadows } from '../../theme'
 * RETHEME: change values here — all consuming files update automatically.
 *
 * Brand identity: dark/athletic, fierce lime-green (parrot) + electric orange (lightning bolt).
 */

// ── Primitive palette ─────────────────────────────────────────────────────────

const palette = {
  // Lime / parrot green — primary accent
  lime300: '#BEF264',
  lime400: '#A3E635',
  lime500: '#84CC16',
  lime600: '#65A30D',
  lime950: '#1A2E05',

  // Orange / lightning bolt — secondary accent
  orange300: '#FD974B',
  orange400: '#FB923C',
  orange500: '#F97316',
  orange600: '#EA580C',
  orange950: '#431407',

  // Amber / warning
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  amber950: '#3A1F00',

  // Red / danger
  red400:  '#F87171',
  red500:  '#EF4444',
  red600:  '#DC2626',
  red950:  '#2A0808',

  // Green / success
  green400: '#4ADE80',
  green500: '#22C55E',
  green950: '#052E16',

  // Teal / info
  teal400: '#2DD4BF',
  teal500: '#14B8A6',

  // Zinc / neutrals
  zinc50:  '#FAFAFA',
  zinc100: '#F4F4F5',
  zinc200: '#E4E4E7',
  zinc300: '#D4D4D8',
  zinc400: '#A1A1AA',
  zinc500: '#71717A',
  zinc600: '#52525B',
  zinc700: '#3F3F46',
  zinc800: '#27272A',
  zinc900: '#18181B',
  zinc950: '#09090B',

  white: '#FFFFFF',
  black: '#000000',
} as const

// ── Semantic color tokens ─────────────────────────────────────────────────────

export const colors = {
  // ── Backgrounds ──────────────────────────────────────────────────────────────
  bg:         '#080808',   // deepest screen background
  bgSurface:  '#111111',   // cards, panels
  bgElevated: '#1A1A1A',   // modals, popovers
  bgMuted:    '#1F1F1F',   // subtle sections
  bgPress:    '#252525',   // pressed/active state

  // ── Borders ───────────────────────────────────────────────────────────────────
  border:       '#242424',
  borderMuted:  '#181818',
  borderFocus:  palette.lime400,
  borderAccent: palette.orange500,

  // ── Text ──────────────────────────────────────────────────────────────────────
  text:          palette.zinc50,    // #FAFAFA — primary
  textSecondary: palette.zinc400,   // #A1A1AA
  textTertiary:  palette.zinc600,   // #52525B
  textInverse:   '#080808',         // dark text on bright buttons
  textDisabled:  palette.zinc700,

  // ── Accents ───────────────────────────────────────────────────────────────────
  primary:       palette.lime400,    // #A3E635 — parrot green
  primaryDim:    palette.lime500,
  primaryMuted:  '#1E2E08',          // dark lime bg — for tinted surfaces
  primarySubtle: '#111A04',

  secondary:       palette.orange500, // #F97316 — lightning orange
  secondaryDim:    palette.orange600,
  secondaryMuted:  '#2A1205',
  secondarySubtle: '#1A0C03',

  // ── Status ────────────────────────────────────────────────────────────────────
  danger:       palette.red500,
  dangerDim:    palette.red600,
  dangerMuted:  '#1F0A0A',

  warning:       palette.amber500,
  warningMuted:  '#221500',

  success:       palette.green500,
  successMuted:  '#061A0E',

  info:          palette.teal400,
  infoMuted:     '#041A18',

  // ── Overlay ───────────────────────────────────────────────────────────────────
  overlay:      'rgba(0, 0, 0, 0.80)',
  overlayLight: 'rgba(0, 0, 0, 0.55)',
} as const

// ── Typography ────────────────────────────────────────────────────────────────

export const typography = {
  /**
   * Font families — swap these when custom fonts are loaded via expo-font.
   * e.g. display: 'BebasNeue_400Regular', body: 'Barlow_400Regular'
   */
  families: {
    display: 'System',
    body:    'System',
    mono:    'monospace' as const,
  },

  sizes: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   17,
    lg:   20,
    xl:   24,
    '2xl': 28,
    '3xl': 34,
    '4xl': 40,
    '5xl': 48,
  },

  weights: {
    regular:   '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
    black:     '900' as const,
  },

  letterSpacing: {
    tight:  -0.5,
    normal:  0,
    wide:    0.5,
    wider:   1.0,
    widest:  2.0,
  },
} as const

// ── Spacing ───────────────────────────────────────────────────────────────────

export const spacing = {
  0:    0,
  0.5:  2,
  1:    4,
  1.5:  6,
  2:    8,
  2.5: 10,
  3:   12,
  3.5: 14,
  4:   16,
  5:   20,
  6:   24,
  7:   28,
  8:   32,
  9:   36,
  10:  40,
  12:  48,
  14:  56,
  16:  64,
} as const

// ── Border radii ──────────────────────────────────────────────────────────────

export const radii = {
  none:  0,
  xs:    4,
  sm:    8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  full: 9999,
} as const

// ── Shadows ───────────────────────────────────────────────────────────────────

export const shadows = {
  none: {},

  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 2,
  },

  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
  },

  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 10,
  },

  // Accent glow — use on hero/CTA elements
  glowLime: {
    shadowColor: palette.lime400,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },

  glowOrange: {
    shadowColor: palette.orange500,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
} as const

// ── Convenience re-export ─────────────────────────────────────────────────────

export const theme = { colors, typography, spacing, radii, shadows } as const
export type Theme = typeof theme

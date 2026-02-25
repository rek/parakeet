# ADR-008: Centralized Theme Token System

**Date**: 2026-02-25

**Status**: Accepted

## Context

The app has no centralized color or spacing system. 54 unique hex values are hardcoded inline across ~15 screen and component files via local `StyleSheet.create()` calls and ad-hoc color objects (e.g. `BAR_COLORS`, `INTENSITY_BADGE_COLORS`, `getBadgeConfig()`).

The palette is Tailwind-inspired (indigo-600, slate-900, amber-400, etc.) but never referenced from a shared source. Changing a brand color — or implementing a UI redesign, which is pending — requires hunting down and updating dozens of individual files.

Current state:
```typescript
// WorkoutCard.tsx
backgroundColor: '#4F46E5'  // CTA button

// today.tsx
backgroundColor: '#4F46E5'  // another CTA button

// settings.tsx
backgroundColor: '#4F46E5'  // another

// 12 more files with the same value...
```

## Decision

Introduce a typed theme token file at `apps/parakeet/src/theme.ts` containing all color, spacing, radius, and typography tokens as plain TypeScript constants. All StyleSheets and inline color references will import from this file instead of using bare hex strings.

No new library dependency is added. This is a pure refactor + organization layer on top of React Native's existing `StyleSheet` primitive.

```typescript
// apps/parakeet/src/theme.ts
export const colors = {
  // Brand
  primary:       '#4F46E5',
  primaryLight:  '#EDE9FE',

  // Neutrals
  text:          '#111827',
  textSecondary: '#374151',
  textMuted:     '#6B7280',
  textSubtle:    '#9CA3AF',
  border:        '#E5E7EB',
  borderLight:   '#F3F4F6',
  surface:       '#FFFFFF',
  surfaceSubtle: '#F9FAFB',

  // Status
  success:       '#10B981',
  successLight:  '#D1FAE5',
  successDark:   '#065F46',
  warning:       '#F59E0B',
  warningLight:  '#FEF3C7',
  warningDark:   '#92400E',
  danger:        '#EF4444',
  dangerLight:   '#FEE2E2',
  dangerDark:    '#7F1D1D',
  info:          '#3B82F6',
  infoLight:     '#DBEAFE',

  // Training-specific semantic tokens
  volumeBelowMev:    '#F59E0B',
  volumeInRange:     '#10B981',
  volumeApproaching: '#FBBF24',
  volumeAtMrv:       '#EF4444',

  intensityHeavy:    '#EF4444',
  intensityExplosive:'#3B82F6',
  intensityRep:      '#10B981',

  block1Bg:   '#DBEAFE',
  block1Text: '#1D4ED8',
  block2Bg:   '#FED7AA',
  block2Text: '#C2410C',
  block3Bg:   '#FECACA',
  block3Text: '#B91C1C',
  deloadBg:   '#F3F4F6',
  deloadText: '#6B7280',
} as const

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 32,
} as const

export const radius = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  full: 9999,
} as const

export const fontSize = {
  xs:   11,
  sm:   12,
  md:   14,
  base: 16,
  lg:   18,
  xl:   20,
  '2xl': 24,
  '3xl': 28,
} as const

export const fontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
} as const

// Convenience re-export for the common case
export const theme = { colors, spacing, radius, fontSize, fontWeight } as const
export type Theme = typeof theme
```

Usage:
```typescript
import { colors, spacing, radius } from '../theme'

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor:     colors.border,
    borderRadius:    radius.xl,
    padding:         spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
  },
})
```

## Rationale

### Pros

- **Zero new dependency** — no library to install, update, or break during Expo SDK upgrades
- **Instant find-and-replace** — changing `primary` from indigo to any other color is a one-line edit
- **TypeScript autocomplete** — `colors.` surfaces all tokens; typos caught at compile time
- **Compatible with anything** — tokens work with RN StyleSheet, Animated, or any styling library we add later
- **Trivial migration** — existing files can be updated incrementally; there is no breaking API change
- **UI redesign ready** — when the new design is finalized, only `theme.ts` needs to change, not 15 files

### Cons

- Still requires each file to `import { colors } from '../theme'` — no automatic enforcement
- No dynamic theming (light/dark toggle) without additional work (context + hook)
- Not co-located with design tooling (Figma tokens plugin, etc.)

## Alternatives Considered

### Alternative 1: NativeWind (Tailwind CSS for React Native)

Use `className="bg-indigo-600 text-white"` instead of StyleSheet objects.

**Why not chosen:**
- Requires rewriting every existing inline style to class names — a large mechanical migration with no functional benefit right now
- Adds a build step (Babel plugin + PostCSS)
- We're already using Tailwind's palette; the token file gives the same single-source-of-truth without the migration cost
- Good option to revisit **after** the UI redesign, when styles are already being rewritten anyway

### Alternative 2: Shopify Restyle

Type-safe theming library with `Box`, `Text` etc. primitives backed by a theme object.

**Why not chosen:**
- Requires replacing React Native primitives (`View`, `Text`, `TouchableOpacity`) with Restyle wrappers — invasive migration
- Opinionated component model doesn't fit the existing screen architecture
- Heavier than needed for a 2-user personal app

### Alternative 3: react-native-unistyles

Modern variant of the styled-system approach with a global theme registry.

**Why not chosen:**
- Another dependency + native module (needs `pod install` on iOS)
- More power than required for current scope
- Adds complexity without solving the immediate problem (scattered hex values)

## Consequences

### Positive

- UI redesign only requires editing `theme.ts` — designer changes flow to all screens automatically
- New screens and components always have a canonical reference for spacing, color, and typography
- Inconsistencies (54 unique colors → ~25 named tokens) are automatically resolved

### Negative

- ~15 files need to be updated during the migration refactor (mechanical work, no logic change)
- Discipline required to not introduce new hardcoded hex values — no linter enforcement yet

### Neutral

- If NativeWind or another styling library is added after the UI redesign, the token file serves as the source of truth that feeds into the library's theme config — no wasted work

## Implementation Notes

### File location
`apps/parakeet/src/theme.ts` — single file, sibling to `src/app/`, `src/lib/`, `src/hooks/`.

### Migration approach
1. Create `theme.ts` with all tokens (use existing palette as starting point)
2. Update files incrementally — prioritize shared components first (badges, cards, buttons), then screens
3. Use TypeScript to catch any remaining bare hex values (`// @ts-expect-error` will flag them if ESLint rule added later)

### Dark mode path (future)
Replace the `colors` constant with a hook:
```typescript
export function useColors() {
  const scheme = useColorScheme()
  return scheme === 'dark' ? darkColors : lightColors
}
```
Token names stay the same; only values change per scheme. No screen-level code changes required.

### Linting (optional)
Add an ESLint rule to warn on hardcoded hex strings in style props:
```json
{ "no-restricted-syntax": ["warn", { "selector": "Literal[value=/^#[0-9a-fA-F]{3,8}$/]" }] }
```

## References

- Current palette audit: 54 unique hex values across ~15 files (`apps/parakeet/src/`)
- Related: mobile-001 through mobile-014 (all screens with inline colors)
- Future: dark mode, Figma token sync, NativeWind migration (post UI redesign)

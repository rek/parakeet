/**
 * Feature registry — single source of truth for all toggleable features.
 *
 * Core features (session logging, program view, today card) are always on.
 * Everything here is optional and can be toggled by the user.
 */

export const FEATURE_CATEGORIES = [
  { id: 'training', label: 'Training Enhancements' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'ai', label: 'AI Features' },
  { id: 'health', label: 'Health & Recovery' },
  { id: 'advanced', label: 'Advanced' },
] as const;

export type FeatureCategory = (typeof FEATURE_CATEGORIES)[number]['id'];

export const FEATURE_REGISTRY = [
  // Training Enhancements
  {
    id: 'warmups',
    label: 'Warmup Sets',
    description: 'Show warmup sets before working sets',
    category: 'training' as const,
    defaultEnabled: true,
  },
  {
    id: 'auxiliary',
    label: 'Auxiliary Exercises',
    description: 'Prescribed accessory work after main lifts',
    category: 'training' as const,
    defaultEnabled: true,
  },
  {
    id: 'restTimer',
    label: 'Rest Timer',
    description: 'Countdown timer between sets',
    category: 'training' as const,
    defaultEnabled: true,
  },
  {
    id: 'sorenessCheckin',
    label: 'Soreness Check-in',
    description: 'Rate muscle soreness before each session',
    category: 'training' as const,
    defaultEnabled: true,
  },
  {
    id: 'adHocWorkouts',
    label: 'Ad-Hoc Workouts',
    description: 'Start unscheduled workouts outside your program',
    category: 'training' as const,
    defaultEnabled: true,
  },

  // Analytics
  {
    id: 'volumeDashboard',
    label: 'Volume Dashboard',
    description: 'Weekly volume tracking and MRV warnings',
    category: 'analytics' as const,
    defaultEnabled: true,
  },
  {
    id: 'achievements',
    label: 'Achievements & PRs',
    description: 'Personal records, badges, and streaks',
    category: 'analytics' as const,
    defaultEnabled: true,
  },
  {
    id: 'streaks',
    label: 'Streak Tracking',
    description: 'Consecutive workout streak counter',
    category: 'analytics' as const,
    defaultEnabled: true,
  },

  // AI Features
  {
    id: 'aiJit',
    label: 'AI Workout Generation',
    description: 'LLM-powered session adjustments',
    category: 'ai' as const,
    defaultEnabled: true,
  },
  {
    id: 'aiRest',
    label: 'AI Rest Suggestions',
    description: 'LLM-suggested rest durations',
    category: 'ai' as const,
    defaultEnabled: true,
  },
  {
    id: 'motivationalMessages',
    label: 'Motivational Messages',
    description: 'AI-generated post-workout messages',
    category: 'ai' as const,
    defaultEnabled: true,
  },
  {
    id: 'formulaSuggestions',
    label: 'Formula AI Suggestions',
    description: 'AI-powered formula adjustment tips',
    category: 'ai' as const,
    defaultEnabled: true,
  },

  // Health & Recovery
  {
    id: 'disruptions',
    label: 'Disruption Reporting',
    description: 'Log injuries, illness, travel, and fatigue',
    category: 'health' as const,
    defaultEnabled: true,
  },
  {
    id: 'cycleTracking',
    label: 'Cycle Tracking',
    description: 'Menstrual cycle phase awareness',
    category: 'health' as const,
    defaultEnabled: true,
  },

  // Advanced
  {
    id: 'wilks',
    label: 'WILKS Score',
    description: 'Bodyweight-relative strength metric',
    category: 'advanced' as const,
    defaultEnabled: true,
  },
  {
    id: 'developer',
    label: 'Developer Tools',
    description: 'JIT strategy selector and cycle feedback',
    category: 'advanced' as const,
    defaultEnabled: true,
  },
  {
    id: 'prescriptionTrace',
    label: 'Workout Reasoning',
    description: 'Tap weights to see JIT reasoning chain',
    category: 'advanced' as const,
    defaultEnabled: true,
  },
  {
    id: 'videoAnalysis',
    label: 'Video Form Analysis',
    description:
      'Record or import lift videos for bar path tracking and form analysis',
    category: 'advanced' as const,
    defaultEnabled: false,
  },
  {
    id: 'gymPartner',
    label: 'Gym Partner Filming',
    description: "Pair with gym partners to film each other's lifts",
    category: 'advanced' as const,
    defaultEnabled: false,
  },
] as const;

export type FeatureId = (typeof FEATURE_REGISTRY)[number]['id'];

export const DEFAULT_FLAGS: Record<FeatureId, boolean> = Object.fromEntries(
  FEATURE_REGISTRY.map((f) => [f.id, f.defaultEnabled])
) as Record<FeatureId, boolean>;

/** "Simple" preset: only training enhancements on */
export const SIMPLE_PRESET: Record<FeatureId, boolean> = Object.fromEntries(
  FEATURE_REGISTRY.map((f) => [f.id, f.category === 'training'])
) as Record<FeatureId, boolean>;

/** "Full" preset: everything on */
export const FULL_PRESET: Record<FeatureId, boolean> = Object.fromEntries(
  FEATURE_REGISTRY.map((f) => [f.id, true])
) as Record<FeatureId, boolean>;

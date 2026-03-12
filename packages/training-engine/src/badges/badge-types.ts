// ── Badge ID ────────────────────────────────────────────────────────────────

export type BadgeId =
  // Consistency & Dedication
  | 'dawn_patrol'
  | 'night_owl'
  | 'iron_monk'
  | 'sunday_scaries_cure'
  | 'year_365'
  | 'perfect_week'
  | 'leg_day_loyalist'
  // Performance & Milestones
  | 'gravity_meet_your_match'
  | 'sir_isaacs_worst_nightmare'
  | 'the_tonne'
  | 'round_number_enjoyer'
  | 'triple_threat'
  | 'technically_a_pr'
  | 'the_centurion'
  // Funny & Situational
  | 'comeback_kid'
  | 'didnt_want_to_be_here'
  | 'volume_goblin'
  | 'one_more_rep'
  | 'plate_math_phd'
  | 'sandbagger'
  | 'bad_day_survivor'
  | 'the_grinder'
  | 'tactical_retreat'
  // Lift Identity
  | 'bench_bro'
  | 'the_specialist'
  | 'equal_opportunity_lifter'
  // Rest & Pacing
  | 'impatient'
  | 'zen_master'
  | 'social_hour'
  // RPE & Effort
  | 'rpe_whisperer'
  | 'sandbag_detected'
  | 'send_it'
  // Program Loyalty
  | 'old_faithful'
  | 'shiny_object_syndrome'
  | 'deload_denier'
  // Volume & Rep Range
  | 'rep_machine'
  | 'singles_club'
  | 'jack_of_all_lifts'
  // Session Milestones
  | 'first_blood'
  | 'parakeet_og'
  | 'century_club'
  | 'five_hundred_club'
  // Wild & Rare
  | 'ghost_protocol'
  | 'marathon_lifter'
  | 'the_streak_breaker'
  // Couples (deferred)
  | 'power_couple';

// ── Badge Category ──────────────────────────────────────────────────────────

export type BadgeCategory =
  | 'consistency'
  | 'performance'
  | 'situational'
  | 'lift_identity'
  | 'rest_pacing'
  | 'rpe_effort'
  | 'program_loyalty'
  | 'volume_rep'
  | 'session_milestones'
  | 'wild_rare'
  | 'couples';

// ── Badge Definition ────────────────────────────────────────────────────────

export interface BadgeDef {
  id: BadgeId;
  name: string;
  description: string;
  flavor: string;
  emoji: string;
  category: BadgeCategory;
}

// ── Earned Badge (returned to UI) ───────────────────────────────────────────

export interface EarnedBadge {
  id: BadgeId;
  name: string;
  emoji: string;
  flavor: string;
}

// ── Checker Context ─────────────────────────────────────────────────────────

/** Set data as available during badge detection. */
export interface BadgeActualSet {
  set_number: number;
  weight_grams: number;
  reps_completed: number;
  rpe_actual?: number;
  actual_rest_seconds?: number;
  is_completed: boolean;
}

export interface BadgePlannedSet {
  set_number: number;
  weight_grams: number;
  reps: number;
  rpe_target?: number;
}

/** Context assembled by the app layer and passed to pure checkers. */
export interface BadgeCheckContext {
  // Current session
  sessionId: string;
  actualSets: BadgeActualSet[];
  plannedSets: BadgePlannedSet[];
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  primaryLift: string | null;
  isDeload: boolean;
  programId: string | null;

  // PR detection result (from existing flow)
  earnedPRs: Array<{
    type: string;
    lift: string;
    value: number;
    weightKg?: number;
  }>;

  // Historical / aggregate data (fetched by orchestrator)
  totalCompletedSessions: number;
  completedCycles: number;
  allLiftE1RMs: Record<string, number>; // lift → best e1RM in kg
  bodyweightKg: number | null;
  streakWeeks: number;

  // Sleep/energy from soreness check-in
  sleepQuality: number | null; // 1-3
  energyLevel: number | null; // 1-3

  // Disruptions
  hasActiveMajorDisruption: boolean;
  daysSinceLastDisruption: number | null;
  lastDisruptionDurationDays: number | null;

  // Session time-of-day
  completedAtHour: number | null; // 0-23

  // Previous session context
  previousSessionWasDeload: boolean;
  previousE1Rm: Record<string, number>; // lift → previous best e1RM
}

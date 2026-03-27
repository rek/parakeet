import type { BadgeDef, BadgeId } from './badge-types';

/** Complete catalog of all fun badges. Metadata only — no detection logic. */
export const BADGE_CATALOG: Record<BadgeId, BadgeDef> = {
  // ── Consistency & Dedication ──────────────────────────────────────────────
  dawn_patrol: {
    id: 'dawn_patrol',
    name: 'Dawn Patrol',
    description: 'Complete 5 sessions before 6:00 AM',
    flavor: 'Most people are asleep. You are under the bar.',
    emoji: '🌅',
    category: 'consistency',
  },
  night_owl: {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete 5 sessions after 9:00 PM',
    flavor: 'The gym belongs to no one at this hour.',
    emoji: '🦉',
    category: 'consistency',
  },
  iron_monk: {
    id: 'iron_monk',
    name: 'Unbroken',
    description:
      'Complete 30 consecutive sessions where every planned set is logged with at least the minimum prescribed reps',
    flavor: 'Thirty sessions. Every set. No exceptions.',
    emoji: '🧱',
    category: 'consistency',
  },
  sunday_scaries_cure: {
    id: 'sunday_scaries_cure',
    name: 'Sunday Iron',
    description: 'Complete a session on 10 different Sundays',
    flavor: 'Ten Sundays under the bar. The week starts here.',
    emoji: '🫠',
    category: 'consistency',
  },
  year_365: {
    id: 'year_365',
    name: '365',
    description: 'Log at least one session in 52 consecutive weeks',
    flavor: 'A full year. Respect.',
    emoji: '📅',
    category: 'consistency',
  },
  perfect_week: {
    id: 'perfect_week',
    name: 'Perfect Week',
    description:
      'Complete all planned sessions and rest days in a 7-day period — no misses, no extras',
    flavor:
      'The schedule said 3 days. You did exactly 3 days. Control freak energy.',
    emoji: '✅',
    category: 'consistency',
  },
  leg_day_loyalist: {
    id: 'leg_day_loyalist',
    name: 'Leg Day Loyalist',
    description:
      'Complete 20 consecutive planned sessions that include squat or deadlift as primary lift',
    flavor: 'You never skip leg day. Literally never.',
    emoji: '🦵',
    category: 'consistency',
  },

  // ── Performance & Milestones ──────────────────────────────────────────────
  gravity_meet_your_match: {
    id: 'gravity_meet_your_match',
    name: 'Gravity, Meet Your Match',
    description: "Any primary lift estimated 1RM exceeds user's bodyweight",
    flavor: 'Welcome to the party',
    emoji: '⚖️',
    category: 'performance',
  },
  sir_isaacs_worst_nightmare: {
    id: 'sir_isaacs_worst_nightmare',
    name: "Sir Isaac's Worst Nightmare",
    description: 'Any primary lift estimated 1RM exceeds 2x bodyweight',
    flavor: "Now you're just showing off",
    emoji: '🌍',
    category: 'performance',
  },
  the_tonne: {
    id: 'the_tonne',
    name: 'The Tonne',
    description:
      'Total session volume (all sets x reps x weight) exceeds 10,000 kg in a single session',
    flavor: 'You moved a lorry today',
    emoji: '🚛',
    category: 'performance',
  },
  round_number_enjoyer: {
    id: 'round_number_enjoyer',
    name: 'Round Number Enjoyer',
    description:
      'Hit a PR that lands exactly on a round number (100, 140, 200 kg etc.)',
    flavor: 'The plates aligned — literally',
    emoji: '🎰',
    category: 'performance',
  },
  triple_threat: {
    id: 'triple_threat',
    name: 'Triple Threat',
    description:
      'Earn all three PR types (1RM, Volume, Rep-at-Weight) in a single session',
    flavor: 'Chaos session. Everything clicked.',
    emoji: '🎪',
    category: 'performance',
  },
  technically_a_pr: {
    id: 'technically_a_pr',
    name: 'Technically a PR',
    description:
      'Set a new estimated 1RM PR by the smallest possible increment (0.5–1.25 kg)',
    flavor: "A PR is a PR. Don't let anyone tell you otherwise.",
    emoji: '🤏',
    category: 'performance',
  },
  the_centurion: {
    id: 'the_centurion',
    name: 'The Centurion',
    description: 'Complete 100+ reps of a single primary lift in one session',
    flavor: 'Breathing squats called. They want their sanity back.',
    emoji: '💯',
    category: 'performance',
  },

  // ── Funny & Situational ───────────────────────────────────────────────────
  comeback_kid: {
    id: 'comeback_kid',
    name: 'Comeback Kid',
    description:
      'Set a PR within 2 sessions of returning from a disruption lasting 7+ days',
    flavor: "You weren't supposed to be stronger after that",
    emoji: '🔙',
    category: 'situational',
  },
  didnt_want_to_be_here: {
    id: 'didnt_want_to_be_here',
    name: "Didn't Want To Be Here",
    description:
      'Log a session with sleep quality "poor" AND energy level "low" — then complete 100% of planned sets',
    flavor: 'Showed up anyway. Legend.',
    emoji: '😤',
    category: 'situational',
  },
  volume_goblin: {
    id: 'volume_goblin',
    name: 'The Accumulator',
    description: 'Earn 5 Volume PRs before earning a single 1RM PR',
    flavor: "You don't care about maxes. You just want MORE.",
    emoji: '👹',
    category: 'situational',
  },
  one_more_rep: {
    id: 'one_more_rep',
    name: 'One More Rep',
    description:
      'Log actual reps exceeding planned reps on 3+ sets in a single session',
    flavor: "The plan said stop. You didn't listen.",
    emoji: '➕',
    category: 'situational',
  },
  plate_math_phd: {
    id: 'plate_math_phd',
    name: 'Plate Math PhD',
    description:
      'Complete a session using 5+ distinct weight values across all sets',
    flavor: 'Your bar changes looked like a university lecture',
    emoji: '🎓',
    category: 'situational',
  },
  sandbagger: {
    id: 'sandbagger',
    name: 'Sandbagger',
    description: 'Hit a new Rep-at-Weight PR on the final set of an exercise',
    flavor: 'Saving the best for last. Or just sandbagging.',
    emoji: '🎤',
    category: 'situational',
  },
  bad_day_survivor: {
    id: 'bad_day_survivor',
    name: 'Bad Day Survivor',
    description:
      'Complete 50%+ of planned volume while a Major disruption is active',
    flavor: 'Everything was wrong and you still showed up.',
    emoji: '🛡️',
    category: 'situational',
  },
  the_grinder: {
    id: 'the_grinder',
    name: 'The Grinder',
    description: 'RPE 9.5+ on 3 or more sets in a single session',
    flavor: 'Nothing moved fast today but everything moved.',
    emoji: '⚙️',
    category: 'situational',
  },
  tactical_retreat: {
    id: 'tactical_retreat',
    name: 'Tactical Retreat',
    description:
      'Return from a deload week and set a PR in the very next session',
    flavor: "Proof that deloads work. You're welcome.",
    emoji: '♟️',
    category: 'situational',
  },

  // ── Lift Identity & Favoritism ────────────────────────────────────────────
  bench_bro: {
    id: 'bench_bro',
    name: 'Bench Bro',
    description: 'Bench estimated 1RM exceeds squat estimated 1RM',
    flavor: 'We all know one. Now you are one.',
    emoji: '🪑',
    category: 'lift_identity',
  },
  the_specialist: {
    id: 'the_specialist',
    name: 'The Specialist',
    description:
      "One lift's estimated 1RM is 40%+ higher than your weakest lift's 1RM",
    flavor: 'You found your calling. The other lifts found your weakness.',
    emoji: '🔬',
    category: 'lift_identity',
  },
  equal_opportunity_lifter: {
    id: 'equal_opportunity_lifter',
    name: 'Equal Opportunity Lifter',
    description:
      'All three primary lift estimated 1RMs within 15% of each other',
    flavor: 'Perfectly balanced, as all things should be.',
    emoji: '⚖️',
    category: 'lift_identity',
  },

  // ── Rest Timer & Pacing ───────────────────────────────────────────────────
  impatient: {
    id: 'impatient',
    name: 'Impatient',
    description:
      'Start 10+ sets before the rest timer expires in a single session',
    flavor: 'The timer is a suggestion and you disagree',
    emoji: '⏩',
    category: 'rest_pacing',
  },
  zen_master: {
    id: 'zen_master',
    name: 'Iron Patience',
    description:
      'Wait for the full rest timer to expire on every single set across 5 consecutive sessions',
    flavor: 'Patience is a virtue. You have too much of it.',
    emoji: '🧘',
    category: 'rest_pacing',
  },
  social_hour: {
    id: 'social_hour',
    name: 'Social Hour',
    description:
      'Average rest between sets exceeds 5 minutes across a full session',
    flavor: 'Were you lifting or catching up with friends?',
    emoji: '☕',
    category: 'rest_pacing',
  },

  // ── RPE & Effort ──────────────────────────────────────────────────────────
  rpe_whisperer: {
    id: 'rpe_whisperer',
    name: 'RPE Whisperer',
    description:
      'Log RPE within 0.5 of the prescribed RPE on every set in a session (min 8 sets)',
    flavor: 'You know your body like a mechanic knows an engine',
    emoji: '🎯',
    category: 'rpe_effort',
  },
  sandbag_detected: {
    id: 'sandbag_detected',
    name: 'Sandbag Detected',
    description: 'Log RPE 6 or below on every set of a session',
    flavor: "Either you're sandbagging or this was a deload. We're watching.",
    emoji: '🏖️',
    category: 'rpe_effort',
  },
  send_it: {
    id: 'send_it',
    name: 'Send It',
    description: "Log RPE 10 on any set that wasn't the last set of the day",
    flavor:
      "You went there. And you still had sets left. Brave or reckless — we'll never tell.",
    emoji: '🚀',
    category: 'rpe_effort',
  },

  // ── Program & Cycle Loyalty ───────────────────────────────────────────────
  old_faithful: {
    id: 'old_faithful',
    name: 'Old Faithful',
    description: 'Run the same program formula for 3+ consecutive cycles',
    flavor: "If it ain't broke, don't fix it",
    emoji: '🪨',
    category: 'program_loyalty',
  },
  shiny_object_syndrome: {
    id: 'shiny_object_syndrome',
    name: 'Shiny Object Syndrome',
    description: 'Change program formula 3+ times within a single cycle',
    flavor: 'The best program is the one you actually finish. Just saying.',
    emoji: '✨',
    category: 'program_loyalty',
  },
  deload_denier: {
    id: 'deload_denier',
    name: 'Deload Denier',
    description: 'Complete 3 consecutive cycles without a single deload week',
    flavor: 'Rest is for the weak. (Please deload.)',
    emoji: '🙅',
    category: 'program_loyalty',
  },

  // ── Volume & Rep Range ────────────────────────────────────────────────────
  rep_machine: {
    id: 'rep_machine',
    name: 'Rep Machine',
    description:
      'Complete 50+ total reps of a single primary lift in one session',
    flavor: 'You turned a strength session into cardio',
    emoji: '🔄',
    category: 'volume_rep',
  },
  singles_club: {
    id: 'singles_club',
    name: 'Singles Club',
    description:
      'Complete a session where every primary lift set is a single (1 rep)',
    flavor: 'Heavy. Quiet. Terrifying.',
    emoji: '☝️',
    category: 'volume_rep',
  },
  jack_of_all_lifts: {
    id: 'jack_of_all_lifts',
    name: 'Jack of All Lifts',
    description:
      'Use 10+ unique auxiliary exercises within a single training cycle',
    flavor:
      "You're trying everything. Commitment issues or open-mindedness — you decide.",
    emoji: '🃏',
    category: 'volume_rep',
  },

  // ── Session Milestones ────────────────────────────────────────────────────
  first_blood: {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Complete your very first session ever',
    flavor: 'Everybody starts somewhere. Welcome.',
    emoji: '🩸',
    category: 'session_milestones',
  },
  parakeet_og: {
    id: 'parakeet_og',
    name: 'Parakeet OG',
    description: 'Complete your very first cycle',
    flavor: 'Everyone starts somewhere. This badge never goes away.',
    emoji: '🦜',
    category: 'session_milestones',
  },
  century_club: {
    id: 'century_club',
    name: 'Century Club',
    description: 'Complete 100 total sessions',
    flavor: "Triple digits. You're not a beginner anymore.",
    emoji: '🏛️',
    category: 'session_milestones',
  },
  five_hundred_club: {
    id: 'five_hundred_club',
    name: '500 Club',
    description: 'Complete 500 total sessions',
    flavor: 'At this point the gym owes you rent.',
    emoji: '👑',
    category: 'session_milestones',
  },

  // ── Wild & Rare ───────────────────────────────────────────────────────────
  ghost_protocol: {
    id: 'ghost_protocol',
    name: 'Ghost Protocol',
    description:
      'Complete a session in under 30 minutes (first set to last set)',
    flavor: 'In and out. Nobody saw you.',
    emoji: '👻',
    category: 'wild_rare',
  },
  marathon_lifter: {
    id: 'marathon_lifter',
    name: 'Marathon Lifter',
    description: 'A session lasts longer than 2 hours (first set to last set)',
    flavor: 'You live here now',
    emoji: '🏕️',
    category: 'wild_rare',
  },
  the_streak_breaker: {
    id: 'the_streak_breaker',
    name: 'The Streak Breaker',
    description: 'Break a streak of 8+ weeks, then rebuild it back to 8+ weeks',
    flavor: "Proof that falling off the wagon isn't the end",
    emoji: '🔗',
    category: 'wild_rare',
  },

  // ── Couples (deferred) ────────────────────────────────────────────────────
  power_couple: {
    id: 'power_couple',
    name: 'Power Couple',
    description: 'Both users complete a session on the same calendar day',
    flavor: 'Couples that lift together, stay together',
    emoji: '💪',
    category: 'couples',
  },
};

/** All badge IDs for iteration. */
export const ALL_BADGE_IDS = Object.keys(BADGE_CATALOG) as BadgeId[];

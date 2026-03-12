/**
 * Badge image generator — Valkeet (Norse/Valkyrie) aesthetic.
 *
 * Generates 192×192 circular emblem PNG images for all 46 achievement badges
 * using Google Imagen 3 via @google/generative-ai and sharp for resizing.
 *
 * Usage:
 *   GOOGLE_AI_API_KEY=... npx tsx scripts/generate-badge-images.ts
 *   GOOGLE_AI_API_KEY=... npx tsx scripts/generate-badge-images.ts --dry-run
 *   GOOGLE_AI_API_KEY=... npx tsx scripts/generate-badge-images.ts --badge dawn_patrol
 *   GOOGLE_AI_API_KEY=... npx tsx scripts/generate-badge-images.ts --start-from comeback_kid
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI, Modality } from '@google/genai';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Badge data (inlined — cannot import from training-engine at script runtime)
// ---------------------------------------------------------------------------

type Category =
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

interface Badge {
  id: string;
  name: string;
  description: string;
  category: Category;
}

const BADGES: Badge[] = [
  // Consistency
  { id: 'dawn_patrol', name: 'Dawn Patrol', description: 'Complete 5 sessions before 6:00 AM', category: 'consistency' },
  { id: 'night_owl', name: 'Night Owl', description: 'Complete 5 sessions after 9:00 PM', category: 'consistency' },
  { id: 'iron_monk', name: 'Iron Monk', description: '30 consecutive sessions with every planned set completed', category: 'consistency' },
  { id: 'sunday_scaries_cure', name: 'Sunday Scaries Cure', description: 'Complete a session on 10 different Sundays', category: 'consistency' },
  { id: 'year_365', name: '365', description: 'Log at least one session in 52 consecutive weeks', category: 'consistency' },
  { id: 'perfect_week', name: 'Perfect Week', description: 'Complete all planned sessions and rest days in a 7-day period', category: 'consistency' },
  { id: 'leg_day_loyalist', name: 'Leg Day Loyalist', description: '20 consecutive planned sessions with squat or deadlift', category: 'consistency' },

  // Performance
  { id: 'gravity_meet_your_match', name: 'Gravity, Meet Your Match', description: 'Any primary lift e1RM exceeds bodyweight', category: 'performance' },
  { id: 'sir_isaacs_worst_nightmare', name: "Sir Isaac's Worst Nightmare", description: 'Any primary lift e1RM exceeds 2x bodyweight', category: 'performance' },
  { id: 'the_tonne', name: 'The Tonne', description: 'Total session volume exceeds 10,000 kg in single session', category: 'performance' },
  { id: 'round_number_enjoyer', name: 'Round Number Enjoyer', description: 'Hit PR on a round number (100, 140, 200 kg)', category: 'performance' },
  { id: 'triple_threat', name: 'Triple Threat', description: 'Earn all three PR types in a single session', category: 'performance' },
  { id: 'technically_a_pr', name: 'Technically a PR', description: 'Set e1RM PR by smallest increment (0.5–1.25 kg)', category: 'performance' },
  { id: 'the_centurion', name: 'The Centurion', description: 'Complete 100+ reps of single primary lift in one session', category: 'performance' },

  // Situational
  { id: 'comeback_kid', name: 'Comeback Kid', description: 'Set PR within 2 sessions of returning from 7+ day disruption', category: 'situational' },
  { id: 'didnt_want_to_be_here', name: "Didn't Want To Be Here", description: 'Log session with poor sleep + low energy, complete 100% of planned sets', category: 'situational' },
  { id: 'volume_goblin', name: 'Volume Goblin', description: 'Earn 5 Volume PRs before earning single 1RM PR', category: 'situational' },
  { id: 'one_more_rep', name: 'One More Rep', description: 'Log actual reps exceeding planned reps on 3+ sets', category: 'situational' },
  { id: 'plate_math_phd', name: 'Plate Math PhD', description: 'Complete session using 5+ distinct weight values', category: 'situational' },
  { id: 'sandbagger', name: 'Sandbagger', description: 'Hit new Rep-at-Weight PR on final set of exercise', category: 'situational' },
  { id: 'bad_day_survivor', name: 'Bad Day Survivor', description: 'Complete 50%+ of planned volume while Major disruption active', category: 'situational' },
  { id: 'the_grinder', name: 'The Grinder', description: 'RPE 9.5+ on 3 or more sets in single session', category: 'situational' },
  { id: 'tactical_retreat', name: 'Tactical Retreat', description: 'Return from deload week and set PR in very next session', category: 'situational' },

  // Lift Identity
  { id: 'bench_bro', name: 'Bench Bro', description: 'Bench e1RM exceeds squat e1RM', category: 'lift_identity' },
  { id: 'the_specialist', name: 'The Specialist', description: "One lift's e1RM is 40%+ higher than weakest lift", category: 'lift_identity' },
  { id: 'equal_opportunity_lifter', name: 'Equal Opportunity Lifter', description: 'All three primary lift e1RMs within 15% of each other', category: 'lift_identity' },

  // Rest Pacing
  { id: 'impatient', name: 'Impatient', description: 'Start 10+ sets before rest timer expires in single session', category: 'rest_pacing' },
  { id: 'zen_master', name: 'Zen Master', description: 'Wait for full rest timer to expire on every set across 5 consecutive sessions', category: 'rest_pacing' },
  { id: 'social_hour', name: 'Social Hour', description: 'Average rest between sets exceeds 5 minutes across full session', category: 'rest_pacing' },

  // RPE Effort
  { id: 'rpe_whisperer', name: 'RPE Whisperer', description: 'Log RPE within 0.5 of prescribed RPE on every set in session (min 8 sets)', category: 'rpe_effort' },
  { id: 'sandbag_detected', name: 'Sandbag Detected', description: 'Log RPE 6 or below on every set of session', category: 'rpe_effort' },
  { id: 'send_it', name: 'Send It', description: "Log RPE 10 on any set that wasn't the last set of the day", category: 'rpe_effort' },

  // Program Loyalty
  { id: 'old_faithful', name: 'Old Faithful', description: 'Run same program formula for 3+ consecutive cycles', category: 'program_loyalty' },
  { id: 'shiny_object_syndrome', name: 'Shiny Object Syndrome', description: 'Change program formula 3+ times within single cycle', category: 'program_loyalty' },
  { id: 'deload_denier', name: 'Deload Denier', description: 'Complete 3 consecutive cycles without single deload week', category: 'program_loyalty' },

  // Volume Rep
  { id: 'rep_machine', name: 'Rep Machine', description: 'Complete 50+ total reps of single primary lift in one session', category: 'volume_rep' },
  { id: 'singles_club', name: 'Singles Club', description: 'Complete session where every primary lift set is single (1 rep)', category: 'volume_rep' },
  { id: 'jack_of_all_lifts', name: 'Jack of All Lifts', description: 'Use 10+ unique auxiliary exercises within single training cycle', category: 'volume_rep' },

  // Session Milestones
  { id: 'first_blood', name: 'First Blood', description: 'Complete your very first session ever', category: 'session_milestones' },
  { id: 'parakeet_og', name: 'Parakeet OG', description: 'Complete your very first cycle', category: 'session_milestones' },
  { id: 'century_club', name: 'Century Club', description: 'Complete 100 total sessions', category: 'session_milestones' },
  { id: 'five_hundred_club', name: '500 Club', description: 'Complete 500 total sessions', category: 'session_milestones' },

  // Wild Rare
  { id: 'ghost_protocol', name: 'Ghost Protocol', description: 'Complete session in under 30 minutes', category: 'wild_rare' },
  { id: 'marathon_lifter', name: 'Marathon Lifter', description: 'Session lasts longer than 2 hours', category: 'wild_rare' },
  { id: 'the_streak_breaker', name: 'The Streak Breaker', description: 'Break streak of 8+ weeks, then rebuild it back to 8+ weeks', category: 'wild_rare' },

  // Couples
  { id: 'power_couple', name: 'Power Couple', description: 'Both users complete session on same calendar day', category: 'couples' },
];

// ---------------------------------------------------------------------------
// Per-badge visual subjects
// ---------------------------------------------------------------------------

const BADGE_SUBJECTS: Record<string, string> = {
  // Consistency
  dawn_patrol:
    'a barbell silhouette against a dramatic sunrise, golden rays breaking through gym windows, chalk dust floating in morning light',
  night_owl:
    'a fierce owl perched atop a loaded barbell, dim gym lights and shadows, moonlight through warehouse windows',
  iron_monk:
    'a hooded figure gripping a barbell with chalked hands, rows of iron plates behind them, disciplined stillness',
  sunday_scaries_cure:
    'a heavy barbell resting on a squat rack, calendar pages scattered on the gym floor, Sunday light streaming in',
  year_365:
    'a massive iron calendar wheel with 52 notches all filled, a barbell through its center like an axle, worn from a full year',
  perfect_week:
    'seven weight plates arranged in a perfect circle on the gym floor, each one pristine, chalk marks showing completion',
  leg_day_loyalist:
    'a powerful leg mid-squat beneath a massive loaded barbell, platform cracking beneath the weight, chalk clouds rising',

  // Performance
  gravity_meet_your_match:
    'a lifter holding a barbell overhead, the gym floor cracking beneath their feet, weight plates defying gravity',
  sir_isaacs_worst_nightmare:
    'a barbell so heavy it bends space around it, gym equipment floating weightless nearby, impossible gravitational pull',
  the_tonne:
    'an enormous pile of iron plates stacked impossibly high, a barbell buried beneath the mountain of weight, dust and chalk rising',
  round_number_enjoyer:
    'a single perfect iron plate with clean edges, balanced on a barbell collar, glowing with achievement, gym setting',
  triple_threat:
    'three barbells crossed like swords, each topped with a different crown — gold silver bronze, dramatic gym spotlight',
  technically_a_pr:
    'a barbell with a tiny fractional plate added, impossibly small weight glowing gold against heavy iron, close-up detail',
  the_centurion:
    'a gladiator helmet resting on a pile of iron plates, tally marks scratched into the gym wall behind it, torch-lit',

  // Situational
  comeback_kid:
    'a phoenix rising from a pile of broken weight plates, gym chalk swirling like ash, embers and iron',
  didnt_want_to_be_here:
    'a lifter slumped but still gripping a loaded barbell, exhaustion visible, dark gym with a single overhead light',
  volume_goblin:
    'a wild-eyed creature hoarding towering stacks of iron plates in a dark gym corner, manic energy, plates everywhere',
  one_more_rep:
    'a barbell bending from extra weight, energy pulsing along the steel bar, chalk explosion, one more rep',
  plate_math_phd:
    'a chalkboard covered in plate-loading calculations, various fractional plates and collars scattered on a gym bench',
  sandbagger:
    'a lifter mid-rep with a knowing smirk, holding back obvious power, barbell moving too easily, sandbagging',
  bad_day_survivor:
    'a battered gym shield with deep scratches, propped against a loaded barbell, still standing after a brutal session',
  the_grinder:
    'massive gears and chains grinding together around a barbell, white-hot sparks flying, industrial gym atmosphere',
  tactical_retreat:
    'a chess knight piece forged from iron, standing on a gym platform, poised to strike forward after stepping back',

  // Lift Identity
  bench_bro:
    'a bench press station glowing under a spotlight, chrome barbell loaded heavy, the undisputed king of the gym floor',
  the_specialist:
    'one massive barbell towering over two smaller ones, dramatic spotlight picking out the dominant lift, gym rack behind',
  equal_opportunity_lifter:
    'three identical barbells at the same height on a rack, perfectly balanced, symmetrical gym lighting',

  // Rest Pacing
  impatient:
    'a shattered hourglass with sand exploding outward, a lifter already gripping the bar before time runs out, urgency',
  zen_master:
    'a lifter in calm meditation pose beside a squat rack, perfect stillness, hourglass sand falling slowly, peaceful gym',
  social_hour:
    'two lifters sharing coffee mugs beside a racked barbell, relaxed and laughing, gym clock showing time passing',

  // RPE Effort
  rpe_whisperer:
    'a precision gauge needle pointing exactly to a target mark, barbell in background, perfect calibration, clockwork accuracy',
  sandbag_detected:
    'a half-filled sandbag next to a lightly loaded barbell, magnifying glass hovering over it, suspicion in the gym',
  send_it:
    'a rocket strapped to a barbell launching upward through a gym ceiling, absolute commitment, flames and chalk dust',

  // Program Loyalty
  old_faithful:
    'a weathered training logbook open on a gym bench, same program written on every page, loyal and unchanged, worn edges',
  shiny_object_syndrome:
    'multiple training programs scattered across a gym floor, a distracted hand reaching for the newest one, sparkles everywhere',
  deload_denier:
    'a cracked iron figure still gripping a heavy barbell, refusing to rest, gym equipment crumbling around them but still lifting',

  // Volume Rep
  rep_machine:
    'a mechanical piston-driven automaton endlessly pressing a barbell, steam venting from joints, industrial gym, repetition incarnate',
  singles_club:
    'a lone massive barbell loaded to maximum in an empty gym, single chalk handprint on the bar, heavy and solitary',
  jack_of_all_lifts:
    'a wall rack of 10 different gym implements — barbells dumbbells kettlebells cables — each glowing a different color',

  // Session Milestones
  first_blood:
    'a single crimson drop on the knurling of a bare barbell, catching the light, chalk dust settling, the beginning',
  parakeet_og:
    'a stylized parakeet bird perched on a barbell, wearing a tiny Viking helmet, fierce and proud, gym background',
  century_club:
    'a grand iron archway with 100 tally marks, barbells forming the pillars, gym lights illuminating the achievement',
  five_hundred_club:
    'a throne built entirely from stacked weight plates, a barbell crown at its peak, imposing gym cathedral scale',

  // Wild Rare
  ghost_protocol:
    'a spectral translucent lifter mid-squat, dissolving into chalk dust and mist, speed trails, empty gym, ethereal',
  marathon_lifter:
    'a campfire setup inside a gym, sleeping bag beside the squat rack, clock showing hours passed, settled in for the long haul',
  the_streak_breaker:
    'a broken chain link being reforged with a hammer on an anvil, sparks flying, the new link glowing brighter, gym forge',

  // Couples
  power_couple:
    'two barbells crossed together like a coat of arms, matching chalk handprints on each bar, unity in the gym',
};

// ---------------------------------------------------------------------------
// Category color map
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<Category, string> = {
  consistency: 'frost blue and ice white',
  performance: 'burnished gold and amber',
  situational: 'deep purple and raven black',
  lift_identity: 'blood red and dark crimson',
  rest_pacing: 'dark teal and deep sea green',
  rpe_effort: 'ember orange and fire red',
  program_loyalty: 'dark forest green and moss',
  volume_rep: 'dark rose and iron pink',
  session_milestones: 'weathered silver and steel',
  wild_rare: 'iridescent aurora colors, shifting blue-green-purple',
  couples: 'warm bronze and copper',
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(badge: Badge): string {
  const subject = BADGE_SUBJECTS[badge.id];
  if (!subject) {
    throw new Error(`No subject defined for badge: ${badge.id}`);
  }
  const categoryColor = CATEGORY_COLORS[badge.category];
  return (
    `Battle-worn metallic badge emblem, dark gritty gym aesthetic, ` +
    `${categoryColor} color tones, ${subject}, ` +
    `powerlifting focus with subtle Norse edge, iron and chalk atmosphere, ` +
    `dramatic lighting from above, no border, no ring, no frame, no circular outline, ` +
    `no text, no letters, no words, no runes, square composition, dark atmosphere, detailed metalwork`
  );
}

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

const OUTPUT_DIR = path.resolve(
  __dirname,
  '../apps/parakeet/assets/images/badges'
);
const IMAGE_SIZE = 192;
const RATE_LIMIT_MS = 2000;

async function generateBadgeImage(
  ai: GoogleGenAI,
  badge: Badge
): Promise<void> {
  const prompt = buildPrompt(badge);
  const outputPath = path.join(OUTPUT_DIR, `${badge.id}.png`);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: prompt,
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) {
    throw new Error('No image data in response');
  }

  const imageBuffer = Buffer.from(part.inlineData.data, 'base64');

  await sharp(imageBuffer)
    .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: 'cover' })
    .png()
    .toFile(outputPath);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): {
  dryRun: boolean;
  badgeId: string | null;
  startFrom: string | null;
  force: boolean;
} {
  const args = process.argv.slice(2);
  let dryRun = false;
  let badgeId: string | null = null;
  let startFrom: string | null = null;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--badge' && args[i + 1]) {
      badgeId = args[++i];
    } else if (args[i] === '--start-from' && args[i + 1]) {
      startFrom = args[++i];
    } else if (args[i] === '--force') {
      force = true;
    }
  }

  return { dryRun, badgeId, startFrom, force };
}

async function main(): Promise<void> {
  const { dryRun, badgeId, startFrom, force } = parseArgs();

  // Validate API key (not needed for dry-run)
  if (!dryRun && !process.env.GOOGLE_AI_API_KEY) {
    console.error('Error: GOOGLE_AI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Determine which badges to process
  let badges = BADGES;

  if (badgeId !== null) {
    const match = BADGES.find((b) => b.id === badgeId);
    if (!match) {
      console.error(`Error: Unknown badge id "${badgeId}"`);
      console.error(`Valid ids: ${BADGES.map((b) => b.id).join(', ')}`);
      process.exit(1);
    }
    badges = [match];
  } else if (startFrom !== null) {
    const idx = BADGES.findIndex((b) => b.id === startFrom);
    if (idx === -1) {
      console.error(`Error: Unknown badge id "${startFrom}"`);
      process.exit(1);
    }
    badges = BADGES.slice(idx);
    console.log(
      `Resuming from "${startFrom}" (${badges.length} badges remaining)`
    );
  }

  if (dryRun) {
    console.log(`\n--- DRY RUN: ${badges.length} badge(s) ---\n`);
    for (const badge of badges) {
      console.log(`[${badge.id}] (${badge.category})`);
      console.log(`  Prompt: ${buildPrompt(badge)}`);
      console.log(`  Output: ${path.join(OUTPUT_DIR, `${badge.id}.png`)}\n`);
    }
    return;
  }

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  console.log(`\nGenerating ${badges.length} badge image(s) -> ${OUTPUT_DIR}\n`);

  for (let i = 0; i < badges.length; i++) {
    const badge = badges[i];
    const prefix = `[${i + 1}/${badges.length}] ${badge.id}`;

    // Skip existing real images unless --force or --badge (explicit target)
    const outputPath = path.join(OUTPUT_DIR, `${badge.id}.png`);
    if (!force && badgeId === null && fs.existsSync(outputPath)) {
      const stat = fs.statSync(outputPath);
      if (stat.size > 2048) {
        console.log(`${prefix} ... skipped (exists, ${Math.round(stat.size / 1024)}KB)`);
        succeeded.push(badge.id);
        continue;
      }
    }

    process.stdout.write(`${prefix} ... `);

    try {
      await generateBadgeImage(ai, badge);
      console.log('done');
      succeeded.push(badge.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`FAILED: ${message}`);
      failed.push({ id: badge.id, error: message });
    }

    // Rate limit between calls (skip delay after last badge)
    if (i < badges.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Succeeded: ${succeeded.length}`);
  if (failed.length > 0) {
    console.log(`Failed:    ${failed.length}`);
    for (const f of failed) {
      console.log(`  - ${f.id}: ${f.error}`);
    }
  } else {
    console.log('Failed:    0');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

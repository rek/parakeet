/**
 * Exercise demo video generator — Valkeet mascot.
 *
 * Generates 8-second looping MP4 demo videos for exercises using Google Veo 3
 * via @google/genai. Start with one exercise to validate, then scale to full catalog.
 *
 * Usage:
 *   GOOGLE_AI_API_KEY=... npx tsx scripts/generate-exercise-videos.ts
 *   GOOGLE_AI_API_KEY=... npx tsx scripts/generate-exercise-videos.ts --dry-run
 *   GOOGLE_AI_API_KEY=... npx tsx scripts/generate-exercise-videos.ts --exercise conventional_deadlift
 *   GOOGLE_AI_API_KEY=... npx tsx scripts/generate-exercise-videos.ts --start-from front_squat
 *   GOOGLE_AI_API_KEY=... npx tsx scripts/generate-exercise-videos.ts --force
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------------------------
// Exercise data
// ---------------------------------------------------------------------------

interface Exercise {
  id: string;
  name: string;
  /** Exercise-specific movement description for the prompt. */
  formDescription: string;
  /** Camera angle override. Defaults to 'front three-quarter view'. */
  cameraAngle?: string;
}

const EXERCISES: Exercise[] = [
  {
    id: 'conventional_deadlift',
    name: 'conventional barbell deadlift',
    formDescription:
      'The mascot stands with feet hip-width under the barbell. It performs a hip hinge ' +
      'with a neutral spine, grips the bar just outside the legs, drives through the legs ' +
      'and hips to lift the bar vertically close to the body, and finishes in a tall lockout ' +
      'with shoulders back. The movement then smoothly lowers back to the starting position ' +
      'to complete the loop.',
  },
  {
    id: 'barbell_bench_press',
    name: 'barbell bench press',
    formDescription:
      'The mascot lies flat on a bench with feet planted on the floor, eyes directly under the bar. ' +
      'It unracks the barbell with a firm grip slightly wider than shoulder width, lowers the bar in a ' +
      'controlled arc to the lower chest with elbows at roughly 45 degrees. The bar must make contact with ' +
      'the chest at the bottom — full range of motion, no stopping short. It then drives the bar explosively ' +
      'back up to complete full lockout with arms fully extended and elbows locked. The movement then smoothly ' +
      'returns to the descent to complete the loop.',
    cameraAngle: 'side profile view at bench height, showing the full bar path from chest to lockout',
  },
  {
    id: 'barbell_back_squat',
    name: 'barbell back squat',
    formDescription:
      'The mascot stands under a racked barbell, positions the bar across the upper traps, grips the bar ' +
      'wide, and unracks it by standing tall. It steps back, sets feet shoulder-width apart with toes ' +
      'slightly out, braces the core, then descends by breaking at the hips and knees simultaneously, ' +
      'keeping the chest up and knees tracking over toes. It squats to below parallel, then drives up ' +
      'through the heels back to a tall standing position. The movement smoothly returns to the descent ' +
      'to complete the loop.',
  },
  // ── Squat auxiliaries ─────────────────────────────────────────────────────
  {
    id: 'barbell_box_squat',
    name: 'barbell box squat',
    formDescription:
      'A sturdy wooden plyometric box is clearly visible behind the lifter. The mascot stands with a barbell ' +
      'across the upper back, feet shoulder-width apart, positioned directly in front of the box. It sits back ' +
      'and down until it sits completely on top of the box, pauses with shins vertical and full weight resting ' +
      'on the box surface, then drives up explosively through the hips to full standing lockout. The box must ' +
      'be clearly visible throughout the entire movement. The movement loops smoothly.',
  },
  {
    id: 'dumbbell_step_up',
    name: 'dumbbell step up',
    formDescription:
      'A solid knee-height wooden box or platform is clearly visible in the scene. The mascot holds a dumbbell ' +
      'in each hand at its sides, standing on the floor behind the box. It places one foot flat on top of the ' +
      'box surface, then drives through that leg to step up and stand fully on top of the box with hips locked ' +
      'out, both feet on the box. It then steps back down to the floor with control. The box must be clearly ' +
      'visible as a distinct elevated platform throughout. The movement loops smoothly.',
  },
  {
    id: 'dumbbell_lunge',
    name: 'dumbbell lunge',
    formDescription:
      'The mascot holds a dumbbell in each hand at its sides, standing tall. It takes a large step forward, ' +
      'lowers the back knee toward the floor while keeping the front shin vertical, then drives through the ' +
      'front foot back to standing with hips fully extended. The movement loops smoothly.',
  },
  {
    id: 'front_barbell_box_squat',
    name: 'front barbell box squat',
    formDescription:
      'The mascot holds a barbell in the front rack position across the front deltoids with elbows high. ' +
      'It sits back and down onto a box behind it, pauses briefly with an upright torso, then drives up ' +
      'through the legs to full standing lockout. The movement loops smoothly.',
  },
  {
    id: 'barbell_front_squat',
    name: 'barbell front squat',
    formDescription:
      'The mascot holds a barbell in the front rack position with elbows high and chest tall. ' +
      'It descends by breaking at the hips and knees, keeping the torso upright, squats to below parallel, ' +
      'then drives up through the legs to full standing lockout. The movement loops smoothly.',
  },
  {
    id: 'pause_squat',
    name: 'pause squat',
    formDescription:
      'The mascot squats with a barbell on the upper back, descending to below parallel, then holds a ' +
      'clear 2-second pause at the bottom with no bounce. It then drives up explosively to full standing ' +
      'lockout. The movement loops smoothly back to the descent.',
  },
  {
    id: 'box_squat',
    name: 'box squat',
    formDescription:
      'The mascot squats with a barbell on the upper back, sitting back onto a box behind it. ' +
      'It pauses on the box with shins vertical, then drives up through the hips to full standing lockout. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'high_bar_squat',
    name: 'high-bar squat',
    formDescription:
      'The mascot positions a barbell high on the traps, stands with feet shoulder-width and toes slightly out. ' +
      'It descends with an upright torso, knees pushing forward over toes, squats to below parallel, ' +
      'then drives up to full standing lockout. The movement loops smoothly.',
  },
  {
    id: 'front_squat',
    name: 'front squat',
    formDescription:
      'The mascot holds a barbell in the front rack with elbows high, descends with an upright torso ' +
      'to below parallel, then drives up to full standing lockout. The movement loops smoothly.',
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian split squat',
    formDescription:
      'The mascot stands in a split stance with the rear foot elevated on a bench behind it, holding dumbbells. ' +
      'It lowers the back knee toward the floor while the front knee bends, then drives up through the front ' +
      'leg to full extension. The movement loops smoothly.',
  },
  {
    id: 'leg_press',
    name: 'leg press',
    formDescription:
      'The mascot sits in a leg press machine with feet shoulder-width on the platform. It releases the safeties, ' +
      'lowers the platform by bending the knees toward the chest, then presses the platform away to full leg ' +
      'extension without locking the knees. The movement loops smoothly.',
    cameraAngle: 'side profile view showing the full range of motion on the leg press sled',
  },
  {
    id: 'hack_squat',
    name: 'hack squat',
    formDescription:
      'The mascot stands on a hack squat machine platform with shoulders under the pads. It descends by bending ' +
      'the knees and hips, lowering to below parallel, then drives the sled up to full leg extension. ' +
      'The movement loops smoothly.',
    cameraAngle: 'side profile view showing the full sled travel',
  },
  {
    id: 'barbell_thruster',
    name: 'barbell thruster',
    formDescription:
      'The mascot holds a barbell in the front rack position. It squats to below parallel, then drives up ' +
      'explosively and presses the bar overhead in one continuous motion to full lockout with arms extended. ' +
      'It lowers the bar back to the front rack as it descends into the next squat. The movement loops smoothly.',
  },

  // ── Bench auxiliaries ─────────────────────────────────────────────────────
  {
    id: 'close_grip_bench_press',
    name: 'close-grip barbell bench press',
    formDescription:
      'The mascot lies on a flat bench, grips the barbell with hands shoulder-width apart. It lowers the bar ' +
      'to the lower chest with elbows tucked close to the body, then presses up to full lockout with arms ' +
      'fully extended. The movement loops smoothly.',
    cameraAngle: 'side profile view at bench height, showing the full bar path from chest to lockout',
  },
  {
    id: 'dumbbell_incline_bench_press',
    name: 'dumbbell incline bench press',
    formDescription:
      'The mascot lies on an incline bench set at 30-45 degrees, holding a dumbbell in each hand. ' +
      'It presses the dumbbells up from shoulder level to full lockout overhead, then lowers them back ' +
      'to the shoulders with control. The movement loops smoothly.',
    cameraAngle: 'side profile view showing the full pressing arc on the incline',
  },
  {
    id: 'barbell_pause_bench_press',
    name: 'barbell pause bench press',
    formDescription:
      'The mascot lies on a flat bench, lowers the barbell to the chest and holds a clear 2-second pause ' +
      'with the bar motionless on the chest, then presses up explosively to full lockout. ' +
      'The movement loops smoothly.',
    cameraAngle: 'side profile view at bench height, showing the full bar path from chest to lockout',
  },
  {
    id: 'decline_bench_press',
    name: 'decline barbell bench press',
    formDescription:
      'The mascot lies on a decline bench with feet hooked under the pads. It lowers the barbell to the ' +
      'lower chest, then presses up to full lockout with arms extended. The movement loops smoothly.',
    cameraAngle: 'side profile view showing the decline angle and full bar path',
  },
  {
    id: 'barbell_incline_bench_press',
    name: 'barbell incline bench press',
    formDescription:
      'The mascot lies on an incline bench set at 30-45 degrees, grips the barbell slightly wider than ' +
      'shoulder width. It lowers the bar to the upper chest, then presses up to full lockout. ' +
      'The movement loops smoothly.',
    cameraAngle: 'side profile view showing the incline angle and full bar path',
  },
  {
    id: 'dumbbell_fly',
    name: 'dumbbell fly',
    formDescription:
      'The mascot lies on a flat bench holding dumbbells above the chest with arms slightly bent. ' +
      'It opens the arms wide in an arc, lowering the dumbbells to the sides until a deep chest stretch, ' +
      'then squeezes the chest to bring the dumbbells back together overhead. The movement loops smoothly.',
    cameraAngle: 'front view from foot of bench, showing the full arm arc',
  },
  {
    id: 'floor_press',
    name: 'floor press',
    formDescription:
      'The mascot lies flat on the gym floor with knees bent, holding a barbell above the chest. ' +
      'It lowers the bar until the upper arms touch the floor, pauses briefly, then presses up to full ' +
      'lockout. The movement loops smoothly.',
    cameraAngle: 'side profile view at floor level, showing the limited range of motion',
  },
  {
    id: 'board_press',
    name: 'board press',
    formDescription:
      'The mascot lies on a flat bench. A board rests on the chest. It lowers the barbell to the board, ' +
      'pauses briefly on contact, then presses up to full lockout. The shortened range of motion focuses ' +
      'on the lockout portion. The movement loops smoothly.',
    cameraAngle: 'side profile view at bench height, showing the partial range of motion',
  },
  {
    id: 'spoto_press',
    name: 'Spoto press',
    formDescription:
      'The mascot lies on a flat bench, lowers the barbell to roughly one inch above the chest and holds ' +
      'it motionless in the air, then presses up to full lockout. The bar never touches the chest. ' +
      'The movement loops smoothly.',
    cameraAngle: 'side profile view at bench height, showing the hover pause above the chest',
  },
  {
    id: 'one_inch_pause_bench',
    name: '1 inch pause bench',
    formDescription:
      'The mascot lies on a flat bench, lowers the barbell to about one inch above the chest and pauses, ' +
      'then presses up to full lockout. The movement loops smoothly.',
    cameraAngle: 'side profile view at bench height',
  },
  {
    id: 'barbell_block_bench_press',
    name: 'barbell block bench press',
    formDescription:
      'The mascot lies on a flat bench with foam blocks on the chest. It lowers the barbell to the blocks, ' +
      'pauses on contact, then presses up to full lockout. The movement loops smoothly.',
    cameraAngle: 'side profile view at bench height',
  },
  {
    id: 'barbell_push_press',
    name: 'barbell push press',
    formDescription:
      'The mascot stands with a barbell in the front rack position at the shoulders. It dips slightly ' +
      'by bending the knees, then drives up explosively through the legs to press the bar overhead to ' +
      'full lockout. It lowers the bar back to the shoulders. The movement loops smoothly.',
  },
  {
    id: 'jm_press',
    name: 'JM press',
    formDescription:
      'The mascot lies on a flat bench holding a barbell with a close grip. It lowers the bar by bending ' +
      'the elbows, bringing the bar toward the chin/neck area in a hybrid skull-crusher/close-grip press ' +
      'motion, then extends the arms to full lockout. The movement loops smoothly.',
    cameraAngle: 'side profile view at bench height',
  },
  {
    id: 'barbell_curl',
    name: 'barbell curl',
    formDescription:
      'The mascot stands upright holding a barbell at arm\'s length with an underhand grip. It curls the ' +
      'bar up by bending the elbows, keeping the upper arms stationary, until the bar reaches shoulder height, ' +
      'then lowers it back down with control. The movement loops smoothly.',
  },
  {
    id: 'dumbbell_curl',
    name: 'dumbbell curl',
    formDescription:
      'The mascot stands upright holding a dumbbell in each hand at arm\'s length. It curls both dumbbells ' +
      'up simultaneously by bending the elbows, squeezing the biceps at the top, then lowers with control. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'cable_curl',
    name: 'cable curl',
    formDescription:
      'The mascot stands facing a low cable pulley, gripping the handle with an underhand grip. It curls ' +
      'the handle up by bending the elbows, keeping upper arms stationary, then lowers with control. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'ez_bar_curl',
    name: 'EZ-bar curl',
    formDescription:
      'The mascot stands upright holding an EZ curl bar at arm\'s length with an underhand angled grip. ' +
      'It curls the bar up to shoulder height, squeezes the biceps, then lowers with control. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'decline_pushups',
    name: 'decline push-ups',
    formDescription:
      'The mascot assumes a push-up position with feet elevated on a bench and hands on the floor. ' +
      'It lowers the chest to the floor by bending the elbows, then pushes up to full arm extension. ' +
      'The movement loops smoothly.',
    cameraAngle: 'side profile view showing the decline angle and full range of motion',
  },
  {
    id: 'diamond_pushups',
    name: 'diamond push-ups',
    formDescription:
      'The mascot assumes a push-up position with hands close together forming a diamond shape under the chest. ' +
      'It lowers the chest to the hands by bending the elbows, then pushes up to full arm extension. ' +
      'The movement loops smoothly.',
    cameraAngle: 'front three-quarter view showing the hand position',
  },
  {
    id: 'archer_pushups',
    name: 'archer push-ups',
    formDescription:
      'The mascot assumes a wide push-up position. It shifts weight to one arm and lowers toward that hand ' +
      'while the other arm extends straight out to the side, then pushes back up to center. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'pike_pushups',
    name: 'pike push-ups',
    formDescription:
      'The mascot sets up in a downward-V position with hips high, hands and feet on the floor. ' +
      'It bends the elbows to lower the head toward the floor, then presses back up to full extension. ' +
      'The movement loops smoothly.',
    cameraAngle: 'side profile view showing the inverted-V body angle',
  },
  {
    id: 'standard_pushups',
    name: 'standard push-ups',
    formDescription:
      'The mascot assumes a straight-body push-up position with hands shoulder-width apart. ' +
      'It lowers the chest to the floor with elbows at 45 degrees, then pushes up to full arm extension. ' +
      'The movement loops smoothly.',
    cameraAngle: 'side profile view showing the full range of motion',
  },
  {
    id: 'wide_pushups',
    name: 'wide push-ups',
    formDescription:
      'The mascot assumes a push-up position with hands placed wider than shoulder width. ' +
      'It lowers the chest to the floor, then pushes up to full arm extension. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'close_grip_pushups',
    name: 'close-grip push-ups',
    formDescription:
      'The mascot assumes a push-up position with hands placed close together directly under the chest. ' +
      'It lowers the chest toward the hands, keeping elbows tucked, then pushes up to full arm extension. ' +
      'The movement loops smoothly.',
  },

  // ── Deadlift auxiliaries ──────────────────────────────────────────────────
  {
    id: 'barbell_hang_clean',
    name: 'barbell hang clean',
    formDescription:
      'The mascot stands holding a barbell at hip height with an overhand grip. It dips slightly, then ' +
      'explosively extends the hips and shrugs to pull the bar upward, catching it in the front rack position ' +
      'with a quick elbow rotation. It stands to full extension, then lowers the bar back to the hang. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'clean_and_jerk',
    name: 'clean and jerk',
    formDescription:
      'The mascot pulls a barbell from the floor to the front rack in one explosive motion, stands to full ' +
      'extension, then dips and drives the bar overhead, splitting the feet and catching it at full lockout ' +
      'with arms extended. It recovers feet together, then lowers the bar. The movement loops smoothly.',
  },
  {
    id: 'power_clean',
    name: 'power clean',
    formDescription:
      'The mascot sets up over a barbell on the floor with a flat back. It pulls the bar explosively from the ' +
      'floor, extends the hips and shrugs, then catches the bar in the front rack without squatting below ' +
      'parallel. It stands to full extension, then lowers the bar. The movement loops smoothly.',
  },
  {
    id: 'lat_pulldown',
    name: 'lat pulldown',
    formDescription:
      'The mascot sits at a lat pulldown machine with thighs under the pad, gripping the wide bar overhead. ' +
      'It pulls the bar down to the upper chest by driving the elbows down and back, squeezes the lats, ' +
      'then returns the bar overhead with control. The movement loops smoothly.',
    cameraAngle: 'front view showing the full pull from overhead to chest',
  },
  {
    id: 'seated_machine_row',
    name: 'seated machine row',
    formDescription:
      'The mascot sits at a seated row machine with chest against the pad, gripping the handles with arms ' +
      'extended. It pulls the handles toward the torso by driving the elbows back, squeezes the shoulder ' +
      'blades together, then extends the arms forward with control. The movement loops smoothly.',
    cameraAngle: 'side profile view showing the full rowing motion',
  },
  {
    id: 'rack_pull',
    name: 'rack pull',
    formDescription:
      'The mascot stands in front of a barbell set on rack pins at knee height. It grips the bar, drives ' +
      'through the hips to pull the bar to full standing lockout with shoulders back, then lowers it back ' +
      'to the pins. The movement loops smoothly.',
  },
  {
    id: 'kettlebell_swing',
    name: 'kettlebell swing',
    formDescription:
      'The mascot stands with feet shoulder-width, holding a kettlebell with both hands. It hikes the bell ' +
      'back between the legs with a hip hinge, then snaps the hips forward to swing the bell to chest height ' +
      'with arms extended. The bell swings back down. The movement loops smoothly.',
  },
  {
    id: 'pendlay_row',
    name: 'Pendlay row',
    formDescription:
      'The mascot bends over with a flat back parallel to the floor, barbell resting on the ground. ' +
      'It grips the bar and rows it explosively into the lower chest, then lowers it back to the floor ' +
      'with a dead stop. The movement loops smoothly.',
  },
  {
    id: 'barbell_row',
    name: 'barbell row',
    formDescription:
      'The mascot bends over at roughly 45 degrees with a flat back, holding a barbell at arm\'s length. ' +
      'It rows the bar into the lower chest by driving the elbows back, squeezes the back, then lowers ' +
      'the bar with control. The movement loops smoothly.',
  },
  {
    id: 'romanian_dumbbell_deadlift',
    name: 'Romanian dumbbell deadlift',
    formDescription:
      'The mascot stands tall holding a dumbbell in each hand in front of the thighs. It hinges at the hips, ' +
      'pushing them back while keeping the back flat, lowering the dumbbells along the legs until a deep ' +
      'hamstring stretch, then drives the hips forward to full standing lockout. The movement loops smoothly.',
  },
  {
    id: 'hexbar_deadlift',
    name: 'hex bar deadlift',
    formDescription:
      'The mascot stands inside a hex bar, grips the side handles, sets the back flat. It drives through ' +
      'the legs and hips to stand to full lockout, then lowers the bar back to the floor with control. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'hexbar_deadlift_deficit',
    name: 'hex bar deadlift from deficit',
    formDescription:
      'The mascot stands inside a hex bar on a raised platform, grips the handles, and pulls from a deeper ' +
      'starting position. It drives through the legs and hips to full standing lockout, then lowers back down. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'dumbbell_row',
    name: 'dumbbell row',
    formDescription:
      'The mascot places one knee and hand on a flat bench for support, holding a dumbbell in the free hand. ' +
      'It rows the dumbbell up to the hip by driving the elbow back, squeezes the lat, then lowers with control. ' +
      'The movement loops smoothly.',
    cameraAngle: 'side profile view showing the single-arm rowing motion',
  },
  {
    id: 'sumo_deadlift',
    name: 'sumo deadlift',
    formDescription:
      'The mascot sets up with a wide stance, toes pointed out, gripping the barbell with a narrow grip ' +
      'between the legs. It drives through the legs and hips to stand to full lockout with shoulders back, ' +
      'then lowers the bar. The movement loops smoothly.',
  },
  {
    id: 'deficit_deadlift',
    name: 'deficit deadlift',
    formDescription:
      'The mascot stands on a raised platform with a barbell on the floor below. It sets up with a flat back ' +
      'in a deeper starting position, then pulls the bar to full standing lockout. It lowers the bar back down. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'kettlebell_deadlift',
    name: 'kettlebell deadlift',
    formDescription:
      'The mascot stands over a kettlebell with feet shoulder-width apart. It hinges at the hips, grips ' +
      'the kettlebell handle, then drives through the hips and legs to stand tall with the bell hanging ' +
      'at arm\'s length. It lowers it back to the floor. The movement loops smoothly.',
  },
  {
    id: 'good_mornings',
    name: 'good mornings',
    formDescription:
      'The mascot stands with a barbell across the upper back, feet shoulder-width. It hinges forward at the ' +
      'hips with a flat back and slight knee bend, lowering the torso toward horizontal, then drives the hips ' +
      'forward to return to standing. The movement loops smoothly.',
  },
  {
    id: 'block_pulls',
    name: 'block pulls',
    formDescription:
      'The mascot sets up over a barbell resting on elevated blocks. It grips the bar with a flat back, pulls ' +
      'to full standing lockout with shoulders back, then lowers the bar back to the blocks. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'stiff_leg_deadlift',
    name: 'stiff-leg deadlift',
    formDescription:
      'The mascot stands with a barbell at arm\'s length, legs nearly straight with only a slight knee bend. ' +
      'It hinges at the hips with a flat back, lowering the bar along the legs until a deep hamstring stretch, ' +
      'then drives the hips forward to full standing lockout. The movement loops smoothly.',
  },
  {
    id: 'barbell_snatch',
    name: 'barbell snatch',
    formDescription:
      'The mascot pulls a barbell from the floor with a wide grip, explosively extends the hips, and catches ' +
      'the bar overhead in one continuous motion with arms fully locked out. It stands to full extension, ' +
      'then lowers the bar. The movement loops smoothly.',
  },
  {
    id: 'dumbbell_snatch',
    name: 'dumbbell snatch',
    formDescription:
      'The mascot pulls a single dumbbell from the floor with one hand, explosively extends the hips, and ' +
      'catches the dumbbell overhead with the arm fully locked out. It lowers the dumbbell back down. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'deadhang',
    name: 'dead hang',
    formDescription:
      'The mascot grips a pull-up bar overhead with both hands and hangs with arms fully extended, body ' +
      'completely still, shoulders engaged. It holds the position for the full duration of the clip. ' +
      'Minimal movement — a static hold demonstration.',
  },

  // ── General / no single-lift affinity ─────────────────────────────────────
  {
    id: 'overhead_press',
    name: 'overhead press',
    formDescription:
      'The mascot stands with a barbell at shoulder height in the front rack. It presses the bar straight ' +
      'overhead to full lockout with arms extended, pushing the head through as the bar passes the face, ' +
      'then lowers it back to the shoulders. The movement loops smoothly.',
  },
  {
    id: 'chin_up_weighted',
    name: 'weighted chin-up',
    formDescription:
      'The mascot hangs from a pull-up bar with an underhand grip, a weight belt with a plate hanging from ' +
      'the waist. It pulls up until the chin clears the bar, then lowers with control to a full dead hang. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'jump_squat',
    name: 'jump squat',
    formDescription:
      'The mascot stands with feet shoulder-width, descends into a squat, then explodes upward into a jump, ' +
      'leaving the ground fully. It lands softly and absorbs into the next squat. The movement loops smoothly.',
  },
  {
    id: 'pistol_squat',
    name: 'pistol squat',
    formDescription:
      'The mascot balances on one leg with the other leg extended straight in front. It descends into a deep ' +
      'single-leg squat with the free leg hovering above the floor, then drives up to full standing on one leg. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'box_jump',
    name: 'box jump',
    formDescription:
      'The mascot stands facing a plyo box, dips into a quarter squat, then jumps explosively onto the box, ' +
      'landing with both feet and standing to full hip extension on top. It steps back down. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'sumo_squat',
    name: 'sumo squat',
    formDescription:
      'The mascot stands with a wide stance and toes pointed outward. It descends by bending the knees and ' +
      'pushing the hips back, keeping the torso upright, then drives up to full standing. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'curtsy_lunge',
    name: 'curtsy lunge',
    formDescription:
      'The mascot stands tall, then steps one foot diagonally behind and across the body into a curtsy position, ' +
      'lowering the back knee toward the floor. It drives through the front leg back to standing. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'hip_thrust',
    name: 'hip thrust',
    formDescription:
      'The mascot sits on the floor with upper back against a bench, feet flat on the ground. It drives the ' +
      'hips upward by squeezing the glutes until the torso is parallel to the floor, holds the lockout, ' +
      'then lowers the hips back down. The movement loops smoothly.',
    cameraAngle: 'side profile view showing the full hip extension',
  },
  {
    id: 'glute_bridge',
    name: 'glute bridge',
    formDescription:
      'The mascot lies flat on the floor with knees bent and feet flat. It drives the hips upward by squeezing ' +
      'the glutes until the body forms a straight line from shoulders to knees, then lowers back down. ' +
      'The movement loops smoothly.',
    cameraAngle: 'side profile view showing the bridge position',
  },
  {
    id: 'nordic_hamstring_curl',
    name: 'Nordic hamstring curl',
    formDescription:
      'The mascot kneels on the floor with ankles anchored. Keeping the body straight from knees to head, ' +
      'it lowers the torso forward under control as far as possible, then curls back up using the hamstrings. ' +
      'The movement loops smoothly.',
    cameraAngle: 'side profile view showing the full eccentric lowering',
  },
  {
    id: 'single_leg_rdl',
    name: 'single-leg RDL',
    formDescription:
      'The mascot stands on one leg, hinges forward at the hip while extending the free leg straight behind, ' +
      'reaching toward the floor with both hands. It drives the hip forward to return to standing on one leg. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'bodyweight_good_morning',
    name: 'bodyweight good morning',
    formDescription:
      'The mascot stands with hands behind the head, feet shoulder-width. It hinges forward at the hips with ' +
      'a flat back, lowering the torso toward horizontal, then drives the hips forward to standing. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'hyperextension',
    name: 'hyperextension',
    formDescription:
      'The mascot positions itself face-down on a hyperextension bench with hips on the pad and feet anchored. ' +
      'It lowers the torso toward the floor, then extends the back and hips to raise the torso in line with ' +
      'the legs. The movement loops smoothly.',
    cameraAngle: 'side profile view showing the full range from flexion to extension',
  },
  {
    id: 'single_leg_glute_bridge',
    name: 'single-leg glute bridge',
    formDescription:
      'The mascot lies on the floor with one foot flat and the other leg extended upward. It drives the hips ' +
      'up using the planted leg until the body is straight from shoulders to knee, then lowers. ' +
      'The movement loops smoothly.',
    cameraAngle: 'side profile view showing the single-leg bridge',
  },
  {
    id: 'donkey_kick',
    name: 'donkey kick',
    formDescription:
      'The mascot is on all fours. It drives one leg upward and back, keeping the knee bent at 90 degrees, ' +
      'squeezing the glute at the top, then lowers the knee back down. The movement loops smoothly.',
    cameraAngle: 'side profile view showing the kicking leg',
  },
  {
    id: 'glute_kickback',
    name: 'glute kickback',
    formDescription:
      'The mascot stands facing a cable machine or is on all fours. It extends one leg straight back, ' +
      'squeezing the glute at full extension, then returns the leg forward. The movement loops smoothly.',
    cameraAngle: 'side profile view showing the full leg extension',
  },
  {
    id: 'pullups',
    name: 'pull-ups',
    formDescription:
      'The mascot hangs from a pull-up bar with an overhand grip, arms fully extended. It pulls up until the ' +
      'chin clears the bar, then lowers with control to a full dead hang. The movement loops smoothly.',
  },
  {
    id: 'chinups',
    name: 'chin-ups',
    formDescription:
      'The mascot hangs from a pull-up bar with an underhand grip, arms fully extended. It pulls up until the ' +
      'chin clears the bar, then lowers with control to a full dead hang. The movement loops smoothly.',
  },
  {
    id: 'pushups',
    name: 'push-ups',
    formDescription:
      'The mascot assumes a straight-body push-up position with hands shoulder-width. It lowers the chest to ' +
      'the floor with elbows at 45 degrees, then pushes up to full arm extension. The movement loops smoothly.',
    cameraAngle: 'side profile view showing the full range of motion',
  },
  {
    id: 'dips',
    name: 'dips',
    formDescription:
      'The mascot supports itself on parallel bars with arms fully extended. It lowers the body by bending ' +
      'the elbows until the shoulders are below the elbows, then presses back up to full lockout. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'air_squat',
    name: 'air squat',
    formDescription:
      'The mascot stands with feet shoulder-width, arms extended forward for balance. It descends into a full ' +
      'squat below parallel, then stands back up to full hip extension. The movement loops smoothly.',
  },
  {
    id: 'lunge',
    name: 'lunge',
    formDescription:
      'The mascot stands tall, takes a large step forward, lowers the back knee toward the floor while the ' +
      'front shin stays vertical, then drives through the front foot back to standing. ' +
      'The movement loops smoothly.',
  },

  // ── Cardio / Core ─────────────────────────────────────────────────────────
  {
    id: 'row_machine',
    name: 'rowing machine',
    formDescription:
      'The mascot sits on a rowing machine with feet strapped in, gripping the handle. It drives back with the ' +
      'legs first, then pulls the handle to the lower chest with elbows back, leans slightly back, then ' +
      'returns forward arms-first, then body, then legs bending. The movement loops smoothly.',
    cameraAngle: 'side profile view showing the full rowing stroke',
  },
  {
    id: 'ski_erg',
    name: 'ski erg',
    formDescription:
      'The mascot stands at a ski erg machine, gripping the handles overhead. It pulls the handles down ' +
      'with a powerful hip hinge and arm pull, driving them past the hips, then returns to the tall ' +
      'starting position with arms overhead. The movement loops smoothly.',
    cameraAngle: 'side profile view showing the full pulling motion',
  },
  {
    id: 'run_treadmill',
    name: 'treadmill run',
    formDescription:
      'The mascot runs on a treadmill with proper form — upright posture, midfoot strike, arms pumping at ' +
      'the sides with elbows bent at 90 degrees. Steady rhythmic running gait. The movement loops seamlessly.',
    cameraAngle: 'side profile view showing the running gait',
  },
  {
    id: 'run_outside',
    name: 'outdoor run',
    formDescription:
      'The mascot runs outdoors with proper form — upright posture, midfoot strike, arms pumping at the sides ' +
      'with elbows bent at 90 degrees. Steady rhythmic running gait. The movement loops seamlessly.',
    cameraAngle: 'side profile view showing the running gait',
  },
  {
    id: 'toes_to_bar',
    name: 'toes to bar',
    formDescription:
      'The mascot hangs from a pull-up bar with arms extended. It swings the legs up in a controlled arc, ' +
      'touching the toes to the bar at the top, then lowers the legs back to hanging. ' +
      'The movement loops smoothly.',
  },
  {
    id: 'plank',
    name: 'plank',
    formDescription:
      'The mascot holds a forearm plank position — body in a perfectly straight line from head to heels, ' +
      'forearms on the floor, core braced tight. It holds the position for the full duration of the clip. ' +
      'Minimal movement — a static hold demonstration.',
    cameraAngle: 'side profile view showing the straight body line',
  },
];

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(exercise: Exercise): string {
  return (
    `8-second seamless loop video, exercise demonstration, dark gritty gym aesthetic.\n` +
    `Character: a muscular humanoid warrior with subtle parakeet features — mostly human face ` +
    `and skin tone, but with a slight beak-like nose, sharp bird-like eyes, and small patches ` +
    `of green-yellow feathers along the jawline, temples, and forearms. Human hair, human skin. ` +
    `Wearing a battle-worn Viking helmet with small wings on the sides, weathered metal shoulder ` +
    `guards, leather lifting belt with runic engravings, chalk-dusted hands. Iron and steel ` +
    `tones on the gear. Powerful athletic build, confident stance. ` +
    `Cinematic realistic rendering, detailed textures, NOT flat cartoon.\n` +
    `Scene: dark warehouse gym, raw concrete floor with chalk dust, iron plates and heavy ` +
    `barbells, dramatic overhead lighting cutting through haze. Faint amber glow from above. ` +
    `Atmosphere of iron, chalk, and grit. Dark moody background keeps focus on the lifter.\n` +
    `The warrior performs ${exercise.name} with perfect powerlifting form.\n` +
    `${exercise.formDescription}\n` +
    `Movement is smooth, controlled, and powerful — clear enough to teach technique. ` +
    `Every rep must show complete full range of motion — full depth at the bottom and full lockout at the top. ` +
    `No partial reps.\n` +
    `Lighting is dramatic and cinematic — harsh overhead light with soft shadows, ` +
    `faint golden aura at the strongest position of the lift. Chalk dust visible in the light.\n` +
    `Camera is static ${exercise.cameraAngle ?? 'front three-quarter view'}, centered framing, no camera movement. ` +
    `The full body and full range of motion must be visible in frame at all times.\n` +
    `The video loops seamlessly — end frame transitions naturally into start frame.\n` +
    `No text, no UI elements, no overlays. Single figure only.`
  );
}

// ---------------------------------------------------------------------------
// Video generation
// ---------------------------------------------------------------------------

const OUTPUT_DIR = path.resolve(
  __dirname,
  '../apps/parakeet/assets/videos/exercises'
);
const POLL_INTERVAL_MS = 10_000;
const RATE_LIMIT_MS = 5_000;

async function generateExerciseVideo(
  ai: GoogleGenAI,
  exercise: Exercise
): Promise<void> {
  const prompt = buildPrompt(exercise);
  const outputPath = path.join(OUTPUT_DIR, `${exercise.id}.mp4`);

  // Submit video generation request
  const operation = await ai.models.generateVideos({
    model: 'veo-2.0-generate-001',
    prompt,
    config: {
      aspectRatio: '9:16',
      numberOfVideos: 1,
      durationSeconds: 8,
      personGeneration: 'allow_all',
    },
  });

  if (!operation.name) {
    throw new Error('No operation name returned');
  }

  // Poll until complete
  process.stdout.write(' polling');
  let op = await ai.operations.getVideosOperation({ operation });

  while (!op.done) {
    process.stdout.write('.');
    await sleep(POLL_INTERVAL_MS);
    op = await ai.operations.getVideosOperation({ operation: op });
  }

  // Extract video data
  const video = op.response?.generatedVideos?.[0];
  if (!video?.video) {
    throw new Error('No video data in response');
  }

  // Video may come as inline base64 data or a URI
  if (video.video.data) {
    const videoBuffer = Buffer.from(video.video.data, 'base64');
    fs.writeFileSync(outputPath, videoBuffer);
  } else if (video.video.uri) {
    // Download from URI — append API key for authentication
    const url = new URL(video.video.uri);
    url.searchParams.set('key', process.env.GOOGLE_AI_API_KEY!);
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
  } else {
    throw new Error('Response contains neither inline data nor URI');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): {
  dryRun: boolean;
  exerciseId: string | null;
  startFrom: string | null;
  force: boolean;
  limit: number | null;
  concurrency: number;
} {
  const args = process.argv.slice(2);
  let dryRun = false;
  let exerciseId: string | null = null;
  let startFrom: string | null = null;
  let force = false;
  let limit: number | null = null;
  let concurrency = 1;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--exercise' && args[i + 1]) {
      exerciseId = args[++i];
    } else if (args[i] === '--start-from' && args[i + 1]) {
      startFrom = args[++i];
    } else if (args[i] === '--force') {
      force = true;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[++i], 10);
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[++i], 10);
    }
  }

  return { dryRun, exerciseId, startFrom, force, limit, concurrency };
}

async function main(): Promise<void> {
  const { dryRun, exerciseId, startFrom, force, limit, concurrency } = parseArgs();

  if (!dryRun && !process.env.GOOGLE_AI_API_KEY) {
    console.error('Error: GOOGLE_AI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Determine which exercises to process
  let exercises = EXERCISES;

  if (exerciseId !== null) {
    const match = EXERCISES.find((e) => e.id === exerciseId);
    if (!match) {
      console.error(`Error: Unknown exercise id "${exerciseId}"`);
      console.error(`Valid ids: ${EXERCISES.map((e) => e.id).join(', ')}`);
      process.exit(1);
    }
    exercises = [match];
  } else if (startFrom !== null) {
    const idx = EXERCISES.findIndex((e) => e.id === startFrom);
    if (idx === -1) {
      console.error(`Error: Unknown exercise id "${startFrom}"`);
      process.exit(1);
    }
    exercises = EXERCISES.slice(idx);
    console.log(
      `Resuming from "${startFrom}" (${exercises.length} exercises remaining)`
    );
  }

  if (dryRun) {
    console.log(`\n--- DRY RUN: ${exercises.length} exercise(s) ---\n`);
    for (const exercise of exercises) {
      console.log(`[${exercise.id}] ${exercise.name}`);
      console.log(`  Prompt:\n${buildPrompt(exercise)}\n`);
      console.log(
        `  Output: ${path.join(OUTPUT_DIR, `${exercise.id}.mp4`)}\n`
      );
    }
    return;
  }

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  // Filter out already-completed exercises
  const toGenerate: Array<{ exercise: Exercise; index: number }> = [];
  for (let i = 0; i < exercises.length; i++) {
    const exercise = exercises[i];
    const outputPath = path.join(OUTPUT_DIR, `${exercise.id}.mp4`);
    if (!force && exerciseId === null && fs.existsSync(outputPath)) {
      const stat = fs.statSync(outputPath);
      if (stat.size > 10240) {
        console.log(
          `[${i + 1}/${exercises.length}] ${exercise.id} ... skipped (exists, ${Math.round(stat.size / 1024)}KB)`
        );
        succeeded.push(exercise.id);
        continue;
      }
    }
    toGenerate.push({ exercise, index: i });
    if (limit !== null && toGenerate.length >= limit) break;
  }

  console.log(
    `\nGenerating ${toGenerate.length} exercise video(s) (concurrency: ${concurrency}) -> ${OUTPUT_DIR}\n`
  );

  // Process in concurrent batches
  for (let b = 0; b < toGenerate.length; b += concurrency) {
    const batch = toGenerate.slice(b, b + concurrency);
    const results = await Promise.allSettled(
      batch.map(async ({ exercise, index }) => {
        const prefix = `[${index + 1}/${exercises.length}] ${exercise.id}`;
        console.log(`${prefix} ... submitting`);
        await generateExerciseVideo(ai, exercise);
        console.log(`${prefix} ... done`);
        return exercise.id;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        succeeded.push(result.value);
      } else {
        const id = batch[results.indexOf(result)].exercise.id;
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.log(`  ${id} FAILED: ${message}`);
        failed.push({ id, error: message });
      }
    }

    // Rate limit between batches (skip after last batch)
    if (b + concurrency < toGenerate.length) {
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

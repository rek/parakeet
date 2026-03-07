/**
 * Historical CSV import tool.
 *
 * Imports Strong-format CSV exports into Parakeet as historical sessions
 * (no program association — pure lift history).
 *
 * Usage:
 *   SUPABASE_URL=http://localhost:54321 \
 *   SUPABASE_SERVICE_KEY=<secret key> \
 *   npx tsx scripts/import-csv.ts \
 *     --file ~/exports/strong.csv \
 *     --user-id <uuid> \
 *     [--unit kg|lbs] \
 *     [--dry-run]
 *
 * The service key bypasses RLS so you can insert on behalf of any user.
 * Get it from: npx supabase status  (the "Secret" key)
 */

import * as fs from 'fs';
import * as readline from 'readline';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActualSet {
  set_number: number;
  weight_grams: number;
  reps_completed: number;
  rpe_actual?: number;
}

interface ParsedRow {
  date: string; // ISO date string YYYY-MM-DD
  datetime: string; // full ISO timestamp
  exerciseName: string;
  setOrder: number;
  weightKg: number;
  reps: number;
  rpe?: number;
}

interface AuxSet extends ActualSet {
  exercise: string;
}

interface MappedSession {
  date: string;
  datetime: string;
  lift: string;
  sets: ActualSet[];
  auxSets: AuxSet[];
}

// Aux exercise to be created in the pool
interface NewAuxExercise {
  exerciseName: string; // canonical name for the pool
  forLift: string; // which lift's pool it belongs to
}

// ---------------------------------------------------------------------------
// Exercise mapping
// ---------------------------------------------------------------------------

// Pre-confirmed mappings — these are applied automatically without prompting.
// Key: exercise name (case-sensitive, must match CSV exactly).
const PRESET_MAPPINGS: Record<string, ExerciseResolution> = {
  // Primary lifts
  'Barbell Back Squat': { kind: 'primary', lift: 'squat' },
  'Barbell Bench Press': { kind: 'primary', lift: 'bench' },
  'Barbell Deadlift': { kind: 'primary', lift: 'deadlift' },
  'Barbell Overhead Press': { kind: 'primary', lift: 'overhead_press' },

  // Aux — squat pool
  'Plate Twist': { kind: 'aux', exerciseName: 'Plate Twist', forLift: 'squat' },
  'Barbell Box Squat': {
    kind: 'aux',
    exerciseName: 'Barbell Box Squat',
    forLift: 'squat',
  },
  'Dumbbell Step Up': {
    kind: 'aux',
    exerciseName: 'Dumbbell Step Up',
    forLift: 'squat',
  },
  'Dumbbell Thruster': {
    kind: 'aux',
    exerciseName: 'Dumbbell Thruster',
    forLift: 'squat',
  },
  'Front barbell box squat': {
    kind: 'aux',
    exerciseName: 'Front barbell box squat',
    forLift: 'squat',
  },
  Plank: { kind: 'aux', exerciseName: 'Plank', forLift: 'squat' },
  'Dumbbell Lunge': {
    kind: 'aux',
    exerciseName: 'Dumbbell Lunge',
    forLift: 'squat',
  },
  'Dumbbell hang clean press': {
    kind: 'aux',
    exerciseName: 'Dumbbell hang clean press',
    forLift: 'squat',
  },
  'Barbell Squat Hold': {
    kind: 'aux',
    exerciseName: 'Barbell Squat Hold',
    forLift: 'squat',
  },
  'Barbell Thruster': {
    kind: 'aux',
    exerciseName: 'Barbell Thruster',
    forLift: 'squat',
  },
  'Barbell clean hang clean squat': {
    kind: 'aux',
    exerciseName: 'Barbell clean hang clean squat',
    forLift: 'squat',
  },
  'Power Clean': { kind: 'aux', exerciseName: 'Power Clean', forLift: 'squat' },
  'Barbell Front Squat': {
    kind: 'aux',
    exerciseName: 'Barbell Front Squat',
    forLift: 'squat',
  },
  Sled: { kind: 'aux', exerciseName: 'Sled', forLift: 'squat' },

  // Aux — deadlift pool
  'Rack Pull': { kind: 'aux', exerciseName: 'Rack Pull', forLift: 'deadlift' },
  'Kettlebell Swing': {
    kind: 'aux',
    exerciseName: 'Kettlebell Swing',
    forLift: 'deadlift',
  },
  'Pendlay Row': {
    kind: 'aux',
    exerciseName: 'Pendlay Row',
    forLift: 'deadlift',
  },
  'Barbell Row': {
    kind: 'aux',
    exerciseName: 'Barbell Row',
    forLift: 'deadlift',
  },
  'Romanian Dumbbell Deadlift': {
    kind: 'aux',
    exerciseName: 'Romanian Dumbbell Deadlift',
    forLift: 'deadlift',
  },
  'Barbell Russian Twist': {
    kind: 'aux',
    exerciseName: 'Barbell Russian Twist',
    forLift: 'deadlift',
  },
  'Hexbar Deadlift': {
    kind: 'aux',
    exerciseName: 'Hexbar Deadlift',
    forLift: 'deadlift',
  },
  'Hexbar Deadlift Deficit': {
    kind: 'aux',
    exerciseName: 'Hexbar Deadlift Deficit',
    forLift: 'deadlift',
  },
  'Dumbbell Upright Row': {
    kind: 'aux',
    exerciseName: 'Dumbbell Upright Row',
    forLift: 'deadlift',
  },
  'Dumbbell Row': {
    kind: 'aux',
    exerciseName: 'Dumbbell Row',
    forLift: 'deadlift',
  },
  '50kg Breifcase Carry': {
    kind: 'aux',
    exerciseName: '50kg Breifcase Carry',
    forLift: 'deadlift',
  },
  'Sumo Deadlift': {
    kind: 'aux',
    exerciseName: 'Sumo Deadlift',
    forLift: 'deadlift',
  },
  Hanging: { kind: 'aux', exerciseName: 'Hanging', forLift: 'deadlift' },
  'Barbell Clean Jerk': {
    kind: 'aux',
    exerciseName: 'Barbell Clean Jerk',
    forLift: 'deadlift',
  },
  'Deficit Deadlift': {
    kind: 'aux',
    exerciseName: 'Deficit Deadlift',
    forLift: 'deadlift',
  },
  'Kettlebell Deadlift': {
    kind: 'aux',
    exerciseName: 'Kettlebell Deadlift',
    forLift: 'deadlift',
  },
  'Dumbbell Snatch': {
    kind: 'aux',
    exerciseName: 'Dumbbell Snatch',
    forLift: 'deadlift',
  },

  // Aux — bench pool
  'Lat Pulldown': {
    kind: 'aux',
    exerciseName: 'Lat Pulldown',
    forLift: 'bench',
  },
  'Close-Grip Barbell Bench Press': {
    kind: 'aux',
    exerciseName: 'Close-Grip Barbell Bench Press',
    forLift: 'bench',
  },
  'Dumbbell Incline Bench Press': {
    kind: 'aux',
    exerciseName: 'Dumbbell Incline Bench Press',
    forLift: 'bench',
  },
  'Barbell Pause Bench Press': {
    kind: 'aux',
    exerciseName: 'Barbell Pause Bench Press',
    forLift: 'bench',
  },
  'Dumbbell Curl': {
    kind: 'aux',
    exerciseName: 'Dumbbell Curl',
    forLift: 'bench',
  },
  'Decline Barbell Bench Press': {
    kind: 'aux',
    exerciseName: 'Decline Barbell Bench Press',
    forLift: 'bench',
  },
  'Barbell Incline Bench Press': {
    kind: 'aux',
    exerciseName: 'Barbell Incline Bench Press',
    forLift: 'bench',
  },
  'Dumbbell Fly': {
    kind: 'aux',
    exerciseName: 'Dumbbell Fly',
    forLift: 'bench',
  },
  'Barbell Reverse Curl': {
    kind: 'aux',
    exerciseName: 'Barbell Reverse Curl',
    forLift: 'bench',
  },
  'Chin Up (weighted)': {
    kind: 'aux',
    exerciseName: 'Chin Up (weighted)',
    forLift: 'bench',
  },
  'Barbell Hang Clean Press': {
    kind: 'aux',
    exerciseName: 'Barbell Hang Clean Press',
    forLift: 'bench',
  },
  'Seated machine row': {
    kind: 'aux',
    exerciseName: 'Seated machine row',
    forLift: 'bench',
  },
  'Assault Bike 5 mins': {
    kind: 'aux',
    exerciseName: 'Assault Bike 5 mins',
    forLift: 'bench',
  },

  // Aux — overhead_press pool
  'Barbell Clean Press': {
    kind: 'aux',
    exerciseName: 'Barbell Clean Press',
    forLift: 'overhead_press',
  },
  'Barbell Push Press': {
    kind: 'aux',
    exerciseName: 'Barbell Push Press',
    forLift: 'overhead_press',
  },
};

// Variants that look like a main lift but are actually accessories — never auto-match these.
const SQUAT_VARIANTS = [
  'front squat',
  'box squat',
  'pause squat',
  'hack squat',
  'belt squat',
  'goblet',
  'leg press',
];
const BENCH_VARIANTS = [
  'incline',
  'decline',
  'close-grip',
  'close grip',
  'pause bench',
  'board',
  'floor press',
  'dumbbell bench',
  'db bench',
  'push up',
  'pushup',
];
const DEADLIFT_VARIANTS = [
  'romanian',
  'rdl',
  'deficit',
  'rack pull',
  'sumo',
  'hex',
  'trap bar',
  'stiff',
  'suitcase',
  'dumbbell deadlift',
  'db deadlift',
  'kettlebell',
];
const OHP_VARIANTS = [
  'push press',
  'behind neck',
  'dumbbell press',
  'db press',
  'seated',
];

function hasVariant(cleaned: string, variants: string[]): boolean {
  return variants.some((v) => cleaned.includes(v));
}

function autoSuggest(exerciseName: string): string | null {
  const cleaned = exerciseName
    .replace(/\s*\(.*?\)/g, '')
    .toLowerCase()
    .trim();

  // Squat: must say "back squat", "low bar" or "high bar" — not just "squat"
  if (!hasVariant(cleaned, SQUAT_VARIANTS)) {
    if (
      cleaned.includes('back squat') ||
      cleaned.includes('low bar') ||
      cleaned.includes('high bar')
    ) {
      return 'squat';
    }
  }

  // Bench: "bench press" without any variant qualifier
  if (!hasVariant(cleaned, BENCH_VARIANTS)) {
    if (cleaned.includes('bench press')) return 'bench';
  }

  // Deadlift: "deadlift" or "dead lift" without any variant qualifier
  if (!hasVariant(cleaned, DEADLIFT_VARIANTS)) {
    if (cleaned.includes('deadlift') || cleaned.includes('dead lift'))
      return 'deadlift';
  }

  // Overhead press: "overhead press", "ohp", "military press" without variant qualifiers
  if (!hasVariant(cleaned, OHP_VARIANTS)) {
    if (
      cleaned.includes('overhead press') ||
      cleaned === 'ohp' ||
      cleaned.includes('military press')
    )
      return 'overhead_press';
  }

  return null;
}

// ---------------------------------------------------------------------------
// CSV parsing — auto-detects format from header
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

type CsvFormat = 'strong' | 'nextset';

function detectFormat(header: string[]): CsvFormat {
  if (header.includes('iscompleted') || header.includes('group'))
    return 'nextset';
  if (header.includes('exercise_name') || header.includes('set_order'))
    return 'strong';
  throw new Error(
    'Unrecognised CSV format. Expected Strong or NextSet export.'
  );
}

/**
 * NextSet format: Date,Group,Exercise,Reps,Weight,IsCompleted,IsAMRAP,Notes
 * - No set order: derived from row sequence within each date+exercise
 * - IsCompleted: skip rows where false
 * - Weight: kg decimal
 * - No time in Date field
 */
function parseNextSet(lines: string[], header: string[]): ParsedRow[] {
  const idx = (name: string) => header.indexOf(name);
  const dateIdx = idx('date');
  const exerciseIdx = idx('exercise');
  const repsIdx = idx('reps');
  const weightIdx = idx('weight');
  const completedIdx = idx('iscompleted');

  if ([dateIdx, exerciseIdx, repsIdx, weightIdx].some((i) => i === -1)) {
    throw new Error(
      'NextSet CSV missing required columns: Date, Exercise, Reps, Weight'
    );
  }

  const rows: ParsedRow[] = [];
  let skipped = 0;
  // Track set number per date+exercise group
  const setCounters = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const fields = parseCSVLine(line);

    const rawDate = fields[dateIdx] ?? '';
    const rawExercise = fields[exerciseIdx] ?? '';
    const rawWeight = fields[weightIdx] ?? '';
    const rawReps = fields[repsIdx] ?? '';
    const rawCompleted =
      completedIdx !== -1 ? (fields[completedIdx] ?? 'true') : 'true';

    // Skip incomplete sets
    if (rawCompleted.toLowerCase() === 'false') {
      skipped++;
      continue;
    }

    if (!rawDate || !/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      skipped++;
      continue;
    }

    const weight = parseFloat(rawWeight);
    const reps = parseInt(rawReps, 10);

    if (
      !rawExercise ||
      isNaN(weight) ||
      isNaN(reps) ||
      weight <= 0 ||
      reps <= 0
    ) {
      skipped++;
      continue;
    }

    const key = `${rawDate}::${rawExercise}`;
    const setOrder = (setCounters.get(key) ?? 0) + 1;
    setCounters.set(key, setOrder);

    rows.push({
      date: rawDate,
      datetime: `${rawDate}T12:00:00Z`,
      exerciseName: rawExercise,
      setOrder,
      weightKg: weight,
      reps,
      rpe: undefined,
    });
  }

  if (skipped > 0)
    console.log(`  Skipped ${skipped} rows (incomplete or unparseable).`);
  return rows;
}

/**
 * Strong format: Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes
 * - Date includes time: "2024-01-15 09:30:00"
 */
function parseStrong(lines: string[], header: string[]): ParsedRow[] {
  const idx = (name: string) => header.indexOf(name);
  const dateIdx = idx('date');
  const exerciseIdx = idx('exercise_name');
  const setOrderIdx = idx('set_order');
  const weightIdx = idx('weight');
  const repsIdx = idx('reps');
  const rpeIdx = idx('rpe');

  if (
    [dateIdx, exerciseIdx, setOrderIdx, weightIdx, repsIdx].some(
      (i) => i === -1
    )
  ) {
    throw new Error(
      'Strong CSV missing required columns: Date, Exercise Name, Set Order, Weight, Reps'
    );
  }

  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const fields = parseCSVLine(line);

    const rawDate = fields[dateIdx] ?? '';
    const rawExercise = fields[exerciseIdx] ?? '';
    const rawSetOrder = fields[setOrderIdx] ?? '';
    const rawWeight = fields[weightIdx] ?? '';
    const rawReps = fields[repsIdx] ?? '';
    const rawRpe = rpeIdx !== -1 ? (fields[rpeIdx] ?? '') : '';

    const dateParts = rawDate.split(' ');
    const dateOnly = dateParts[0];
    if (!dateOnly || !/^\d{4}-\d{2}-\d{2}/.test(dateOnly)) {
      skipped++;
      continue;
    }

    const setOrder = parseInt(rawSetOrder, 10);
    const weight = parseFloat(rawWeight);
    const reps = parseInt(rawReps, 10);

    if (!rawExercise || isNaN(setOrder) || isNaN(weight) || isNaN(reps)) {
      skipped++;
      continue;
    }
    if (weight <= 0 || reps <= 0) {
      skipped++;
      continue;
    }

    const timePart = dateParts[1] ?? '12:00:00';
    const rpe = rawRpe ? parseFloat(rawRpe) : undefined;

    rows.push({
      date: dateOnly,
      datetime: `${dateOnly}T${timePart}Z`,
      exerciseName: rawExercise,
      setOrder,
      weightKg: weight,
      reps,
      rpe: rpe && !isNaN(rpe) ? rpe : undefined,
    });
  }

  if (skipped > 0) console.log(`  Skipped ${skipped} unparseable rows.`);
  return rows;
}

function parseCSV(content: string): { rows: ParsedRow[]; format: CsvFormat } {
  const lines = content.split('\n').map((l) => l.trimEnd());
  if (lines.length < 2) return { rows: [], format: 'strong' };

  const header = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, '_')
  );
  const format = detectFormat(header);
  const rows =
    format === 'nextset'
      ? parseNextSet(lines, header)
      : parseStrong(lines, header);

  return { rows, format };
}

// ---------------------------------------------------------------------------
// Interactive exercise mapping
// ---------------------------------------------------------------------------

type ExerciseResolution =
  | { kind: 'primary'; lift: string }
  | { kind: 'aux'; exerciseName: string; forLift: string }
  | { kind: 'skip' };

async function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function mapExercises(
  exerciseNames: string[],
  rl: readline.Interface
): Promise<Map<string, ExerciseResolution>> {
  const mapping = new Map<string, ExerciseResolution>();
  const canonicalLifts = ['squat', 'bench', 'deadlift', 'overhead_press'];

  // Apply presets silently first
  const needsPrompt: string[] = [];
  for (const name of exerciseNames) {
    if (PRESET_MAPPINGS[name]) {
      mapping.set(name, PRESET_MAPPINGS[name]);
    } else {
      needsPrompt.push(name);
    }
  }

  const presetCount = exerciseNames.length - needsPrompt.length;
  if (presetCount > 0)
    console.log(
      `\n  Auto-mapped ${presetCount} known exercise(s) from presets.`
    );

  if (needsPrompt.length === 0) return mapping;

  console.log('\nFor each unknown exercise:');
  console.log('  - Press Enter to accept the suggestion (primary lift)');
  console.log(
    '  - Type a lift key to override: squat / bench / deadlift / overhead_press'
  );
  console.log('  - Type "skip" to ignore it entirely');
  console.log(
    "  - Anything else → added as an auxiliary exercise (you'll pick which lift pool)\n"
  );

  for (const name of needsPrompt) {
    const suggestion = autoSuggest(name);
    const hint = suggestion
      ? suggestion
      : 'no match — Enter to add as aux, or skip';
    const answer = (await ask(rl, `  "${name}" [${hint}]: `))
      .trim()
      .toLowerCase();

    if (answer === 'skip') {
      mapping.set(name, { kind: 'skip' });
    } else if (answer === '' && suggestion) {
      // Accepted canonical suggestion
      mapping.set(name, { kind: 'primary', lift: suggestion });
    } else if (canonicalLifts.includes(answer)) {
      // Explicit canonical lift
      mapping.set(name, { kind: 'primary', lift: answer });
    } else {
      // Everything else (including blank with no suggestion, or any free-text name) → aux
      let forLift = '';
      while (!canonicalLifts.includes(forLift)) {
        forLift = (
          await ask(
            rl,
            `    Add "${name}" to which lift pool? (${canonicalLifts.join('/')}): `
          )
        )
          .trim()
          .toLowerCase();
      }
      mapping.set(name, { kind: 'aux', exerciseName: name, forLift });
    }
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// Weight conversion
// ---------------------------------------------------------------------------

function toGrams(weightKg: number, unit: 'kg' | 'lbs'): number {
  if (unit === 'lbs') {
    return Math.round(weightKg * 453.592);
  }
  return Math.round(weightKg * 1000);
}

// ---------------------------------------------------------------------------
// Build sessions from parsed rows + mapping
// ---------------------------------------------------------------------------

function buildSessions(
  rows: ParsedRow[],
  mapping: Map<string, ExerciseResolution>,
  unit: 'kg' | 'lbs'
): {
  sessions: MappedSession[];
  newAuxExercises: NewAuxExercise[];
  skippedSets: number;
} {
  const groups = new Map<string, MappedSession>();
  // Aux sets staged by date → [AuxSet], to be attached after all primary sessions are built
  const auxByDate = new Map<string, { forLift: string; set: AuxSet }[]>();
  let skippedSets = 0;

  // Collect new aux exercises (deduplicated)
  const auxExercisesSeen = new Map<string, NewAuxExercise>(); // key: exerciseName

  for (const row of rows) {
    const resolution = mapping.get(row.exerciseName);
    if (!resolution || resolution.kind === 'skip') {
      skippedSets++;
      continue;
    }

    const actualSet: ActualSet = {
      set_number: row.setOrder,
      weight_grams: toGrams(row.weightKg, unit),
      reps_completed: row.reps,
      rpe_actual: row.rpe,
    };

    if (resolution.kind === 'primary') {
      const key = `${row.date}::${resolution.lift}`;
      if (!groups.has(key)) {
        groups.set(key, {
          date: row.date,
          datetime: row.datetime,
          lift: resolution.lift,
          sets: [],
          auxSets: [],
        });
      }
      groups.get(key)!.sets.push(actualSet);
    } else {
      // aux
      if (!auxExercisesSeen.has(resolution.exerciseName)) {
        auxExercisesSeen.set(resolution.exerciseName, {
          exerciseName: resolution.exerciseName,
          forLift: resolution.forLift,
        });
      }
      if (!auxByDate.has(row.date)) auxByDate.set(row.date, []);
      auxByDate.get(row.date)!.push({
        forLift: resolution.forLift,
        set: { ...actualSet, exercise: resolution.exerciseName },
      });
    }
  }

  // Attach aux sets to their session: prefer the session whose lift matches forLift,
  // fall back to the first session that day.
  for (const [date, auxEntries] of auxByDate) {
    const sessionsThisDay = [...groups.values()].filter((s) => s.date === date);
    if (sessionsThisDay.length === 0) continue; // no primary lift that day — skip aux

    for (const { forLift, set } of auxEntries) {
      const target =
        sessionsThisDay.find((s) => s.lift === forLift) ?? sessionsThisDay[0];
      target.auxSets.push(set);
    }
  }

  return {
    sessions: Array.from(groups.values()),
    newAuxExercises: Array.from(auxExercisesSeen.values()),
    skippedSets,
  };
}

// ---------------------------------------------------------------------------
// Supabase insert
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertSessions(
  supabase: any,
  userId: string,
  sessions: MappedSession[],
  newAuxExercises: NewAuxExercise[]
): Promise<{
  insertedSessions: number;
  insertedLogs: number;
  insertedAuxExercises: number;
}> {
  // Cast to any — createClient without Database generic resolves table types to never.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // -------------------------------------------------------------------------
  // Create auxiliary_exercises pool entries first
  // -------------------------------------------------------------------------
  let insertedAuxExercises = 0;

  if (newAuxExercises.length > 0) {
    // Fetch current max pool_position per lift to append at the end
    const { data: existing } = await db
      .from('auxiliary_exercises')
      .select('lift, pool_position')
      .eq('user_id', userId);

    const maxByLift = new Map<string, number>();
    for (const row of existing ?? []) {
      const curr = maxByLift.get(row.lift) ?? 0;
      if (row.pool_position > curr) maxByLift.set(row.lift, row.pool_position);
    }

    for (const aux of newAuxExercises) {
      const nextPos = (maxByLift.get(aux.forLift) ?? 0) + 1;
      maxByLift.set(aux.forLift, nextPos);

      const { error } = await db.from('auxiliary_exercises').insert({
        user_id: userId,
        exercise_name: aux.exerciseName,
        lift: aux.forLift,
        pool_position: nextPos,
        primary_muscles: [], // user can edit in settings → Auxiliary Exercises
        is_active: true,
      });
      if (error)
        throw new Error(`auxiliary_exercises insert failed: ${error.message}`);
      insertedAuxExercises++;
    }
  }

  // -------------------------------------------------------------------------
  // Insert sessions + logs
  // -------------------------------------------------------------------------
  let insertedSessions = 0;
  let insertedLogs = 0;

  for (const session of sessions) {
    const { data: sessionRow, error: sessionErr } = await db
      .from('sessions')
      .insert({
        user_id: userId,
        program_id: null,
        primary_lift: session.lift,
        intensity_type: 'import',
        day_number: 0,
        week_number: 0,
        block_number: null,
        is_deload: false,
        status: 'completed',
        planned_date: session.date,
        completed_at: session.datetime,
        planned_sets: null,
        jit_generated_at: null,
      })
      .select('id')
      .single();

    if (sessionErr)
      throw new Error(`Session insert failed: ${sessionErr.message}`);
    insertedSessions++;

    const { error: logErr } = await db.from('session_logs').insert({
      session_id: sessionRow.id,
      user_id: userId,
      actual_sets: session.sets,
      auxiliary_sets: session.auxSets.length > 0 ? session.auxSets : null,
      session_rpe: null,
      completion_pct: 100,
      performance_vs_plan: 'at',
      started_at: null,
      completed_at: session.datetime,
    });

    if (logErr) throw new Error(`Session log insert failed: ${logErr.message}`);
    insertedLogs++;
  }

  return { insertedSessions, insertedLogs, insertedAuxExercises };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const filePath = get('--file');
  const userId = get('--user-id');
  const unitArg = get('--unit') as 'kg' | 'lbs' | undefined;
  const isDryRun = args.includes('--dry-run');

  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_KEY'];

  if (!filePath || !userId || !supabaseUrl || !serviceKey) {
    console.error(`
Usage:
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \\
  npx tsx scripts/import-csv.ts \\
    --file <path-to-csv> \\
    --user-id <uuid> \\
    [--unit kg|lbs] \\
    [--dry-run]

Get the service key from: npx supabase status  (the "Secret" key)
    `);
    process.exit(1);
  }

  const unit: 'kg' | 'lbs' = unitArg === 'lbs' ? 'lbs' : 'kg';

  // Parse CSV
  console.log(`\nParsing ${filePath} (unit: ${unit})...`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const { rows, format } = parseCSV(content);
  console.log(`  Detected format: ${format}`);

  if (rows.length === 0) {
    console.log('No parseable rows found. Exiting.');
    process.exit(0);
  }

  const uniqueExercises = [...new Set(rows.map((r) => r.exerciseName))].sort();
  const dateRange = [rows[0].date, rows[rows.length - 1].date];

  console.log(`\nFound:`);
  console.log(
    `  ${rows.length} sets across ${uniqueExercises.length} exercise(s)`
  );
  console.log(`  Date range: ${dateRange[0]} → ${dateRange[1]}`);

  // Interactive exercise mapping
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const mapping = await mapExercises(uniqueExercises, rl);
  rl.close();

  const primaryCount = [...mapping.values()].filter(
    (v) => v.kind === 'primary'
  ).length;
  const auxCount = [...mapping.values()].filter((v) => v.kind === 'aux').length;
  const skippedCount = [...mapping.values()].filter(
    (v) => v.kind === 'skip'
  ).length;
  console.log(
    `\nMapped: ${primaryCount} primary, ${auxCount} aux, ${skippedCount} skipped`
  );

  const { sessions, newAuxExercises, skippedSets } = buildSessions(
    rows,
    mapping,
    unit
  );
  const totalAuxSets = sessions.reduce((n, s) => n + s.auxSets.length, 0);

  console.log(`\nDry run summary:`);
  console.log(`  Sessions to insert:       ${sessions.length}`);
  console.log(
    `  Primary sets:             ${sessions.reduce((n, s) => n + s.sets.length, 0)}`
  );
  if (totalAuxSets > 0)
    console.log(`  Aux sets to log:          ${totalAuxSets}`);
  if (newAuxExercises.length > 0) {
    console.log(`  New aux exercises to add: ${newAuxExercises.length}`);
    for (const ax of newAuxExercises)
      console.log(`    + "${ax.exerciseName}" → ${ax.forLift} pool`);
  }
  if (skippedSets > 0)
    console.log(`  Skipped sets:             ${skippedSets}`);

  if (isDryRun) {
    console.log('\n--dry-run flag set. No data was written.');
    process.exit(0);
  }

  // Confirm
  const confirm = await new Promise<string>((resolve) => {
    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl2.question('\nImport? [y/N]: ', (ans) => {
      rl2.close();
      resolve(ans);
    });
  });

  if (confirm.trim().toLowerCase() !== 'y') {
    console.log('Aborted.');
    process.exit(0);
  }

  // Insert — createClient<any> avoids generic resolution issues in CLI context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient<any>(supabaseUrl, serviceKey);
  console.log('\nInserting...');

  const { insertedSessions, insertedLogs, insertedAuxExercises } =
    await insertSessions(supabase, userId, sessions, newAuxExercises);

  console.log(`\nDone.`);
  console.log(`  Sessions inserted:        ${insertedSessions}`);
  console.log(`  Logs inserted:            ${insertedLogs}`);
  if (insertedAuxExercises > 0) {
    console.log(`  Aux exercises added:      ${insertedAuxExercises}`);
    console.log(`  (Edit muscles in Settings → Auxiliary Exercises)`);
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});

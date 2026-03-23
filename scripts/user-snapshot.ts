/**
 * User training data snapshot — diagnostic tool.
 *
 * Queries production Supabase and prints a structured snapshot of a user's
 * training state for quick debugging: profile, maxes, active program, formula
 * config, schedule health, recent session history, and aux work summary.
 *
 * Usage:
 *   SUPABASE_URL=https://... \
 *   SUPABASE_SERVICE_KEY=<secret key> \
 *   npx tsx scripts/user-snapshot.ts [--user-id <uuid>]
 *
 * If --user-id is omitted, auto-detects the first user with an active program.
 * The service key bypasses RLS so all user data is accessible.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------------
// ANSI color helpers
// ---------------------------------------------------------------------------

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function red(s: string) {
  return `${RED}${s}${RESET}`;
}

function yellow(s: string) {
  return `${YELLOW}${s}${RESET}`;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function col(s: string, w: number) {
  return s.padEnd(w).slice(0, w);
}

function gramsToKg(grams: number) {
  return Math.round((grams / 1000) * 10) / 10;
}

function printSeparator(char = '─', width = 76) {
  console.log(char.repeat(width));
}

function printHeader(title: string) {
  console.log('');
  printSeparator('═');
  console.log(`  ${title}`);
  printSeparator('═');
}

function printSubHeader(title: string) {
  console.log('');
  console.log(`  ${title}`);
  printSeparator('─', 50);
}

function fmtDate(iso: string | null) {
  return iso ? iso.slice(0, 10) : 'n/a';
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ---------------------------------------------------------------------------
// Inline JSONB shape types (no imports from app code — runs standalone)
// ---------------------------------------------------------------------------

interface PlannedSet {
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe_target?: number;
}

interface ActualSet {
  set_number: number;
  weight_grams: number;
  reps_completed: number;
  rpe_actual?: number;
}

interface AuxSet {
  exercise: string;
  set_number: number;
  weight_grams: number;
  reps_completed: number;
  rpe_actual?: number;
}

function parsePlannedSets(raw: unknown): PlannedSet[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is PlannedSet =>
      typeof s === 'object' && s !== null && 'set_number' in s && 'weight_kg' in s,
  );
}

function parseActualSets(raw: unknown): ActualSet[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is ActualSet =>
      typeof s === 'object' && s !== null && 'set_number' in s && 'weight_grams' in s,
  );
}

function parseAuxSets(raw: unknown): AuxSet[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is AuxSet =>
      typeof s === 'object' && s !== null && 'exercise' in s && 'weight_grams' in s,
  );
}

// ---------------------------------------------------------------------------
// Warnings collector
// ---------------------------------------------------------------------------

const warnings: string[] = [];

function warn(msg: string, severity: 'warning' | 'error' = 'warning') {
  warnings.push(severity === 'error' ? red(`[ERROR] ${msg}`) : yellow(`[WARN]  ${msg}`));
}

// ---------------------------------------------------------------------------
// User auto-detection
// ---------------------------------------------------------------------------

async function resolveUserId(argUserId: string | null) {
  if (argUserId) return argUserId;

  const { data, error } = await supabase
    .from('programs')
    .select('user_id')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (error || !data) {
    console.error('Could not auto-detect user: no active program found.');
    process.exit(1);
  }

  console.log(`Auto-detected user: ${data.user_id}`);
  return data.user_id as string;
}

// ---------------------------------------------------------------------------
// Section 1: Profile
// ---------------------------------------------------------------------------

async function printProfile(userId: string) {
  printHeader('1. Profile');

  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, biological_sex, bodyweight_kg, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.log(red('  Profile not found.'));
    warn('No profile row for this user.', 'error');
    return;
  }

  console.log(`  display_name   : ${data.display_name ?? '(unset)'}`);
  console.log(`  biological_sex : ${data.biological_sex ?? '(unset)'}`);
  console.log(`  bodyweight_kg  : ${data.bodyweight_kg != null ? `${data.bodyweight_kg} kg` : '(unset)'}`);
  console.log(`  created_at     : ${fmtDate(data.created_at)}`);
  console.log(`  user_id        : ${userId}`);
}

// ---------------------------------------------------------------------------
// Section 2: Lifter Maxes
// ---------------------------------------------------------------------------

async function printLifterMaxes(userId: string) {
  printHeader('2. Lifter Maxes');

  const { data, error } = await supabase
    .from('lifter_maxes')
    .select(
      'squat_1rm_grams, bench_1rm_grams, deadlift_1rm_grams, source, recorded_at',
    )
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.log(yellow('  No lifter maxes recorded.'));
    warn('No lifter maxes — JIT cannot generate weight prescriptions.', 'error');
    return;
  }

  console.log(`  squat    : ${gramsToKg(data.squat_1rm_grams)} kg`);
  console.log(`  bench    : ${gramsToKg(data.bench_1rm_grams)} kg`);
  console.log(`  deadlift : ${gramsToKg(data.deadlift_1rm_grams)} kg`);
  console.log(`  source   : ${data.source}`);
  console.log(`  recorded : ${fmtDate(data.recorded_at)}`);
}

// ---------------------------------------------------------------------------
// Section 3: Active Program
// ---------------------------------------------------------------------------

interface ProgramRow {
  id: string;
  program_mode: string;
  start_date: string;
  training_days: number[] | null;
  training_days_per_week: number;
  unending_session_counter: number;
  version: number;
  status: string;
}

async function fetchActiveProgram(userId: string) {
  const { data, error } = await supabase
    .from('programs')
    .select(
      'id, program_mode, start_date, training_days, training_days_per_week, unending_session_counter, version, status',
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as ProgramRow;
}

async function printActiveProgram(userId: string) {
  printHeader('3. Active Program');

  const program = await fetchActiveProgram(userId);

  if (!program) {
    console.log(yellow('  No active program.'));
    warn('No active program — nothing to schedule or prescribe.', 'error');
    return null;
  }

  const dayNames = (program.training_days ?? [])
    .map((d) => DAY_NAMES[d] ?? String(d))
    .join(', ');

  console.log(`  program_mode             : ${program.program_mode}`);
  console.log(`  start_date               : ${fmtDate(program.start_date)}`);
  console.log(`  training_days            : [${dayNames}]`);
  console.log(`  training_days_per_week   : ${program.training_days_per_week}`);
  console.log(`  unending_session_counter : ${program.unending_session_counter}`);
  console.log(`  version                  : ${program.version}`);
  console.log(`  id                       : ${program.id}`);

  return program;
}

// ---------------------------------------------------------------------------
// Section 4: Formula Config
// ---------------------------------------------------------------------------

async function printFormulaConfig(userId: string) {
  printHeader('4. Formula Config');

  const { data, error } = await supabase
    .from('formula_configs')
    .select('version, source, overrides, ai_rationale, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !data) {
    console.log(red('  No active formula config found.'));
    warn('No active formula_config — JIT cannot generate prescriptions.', 'error');
    return;
  }

  console.log(`  version     : ${data.version}`);
  console.log(`  source      : ${data.source}`);
  console.log(`  created_at  : ${fmtDate(data.created_at)}`);

  const overrides = data.overrides;
  const hasOverrides =
    overrides !== null &&
    typeof overrides === 'object' &&
    !Array.isArray(overrides) &&
    Object.keys(overrides).length > 0;

  if (hasOverrides) {
    console.log('  overrides   :');
    for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
      console.log(`    ${k}: ${JSON.stringify(v)}`);
    }
  } else {
    console.log('  overrides   : (none)');
  }

  if (data.ai_rationale) {
    const rationale = String(data.ai_rationale);
    const preview = rationale.length > 120 ? rationale.slice(0, 120) + '…' : rationale;
    console.log(`  ai_rationale: ${preview}`);
  }
}

// ---------------------------------------------------------------------------
// Section 5: Schedule Overview
// ---------------------------------------------------------------------------

interface SessionRow {
  id: string;
  status: string;
  planned_date: string | null;
  primary_lift: string | null;
  intensity_type: string | null;
  week_number: number;
  day_number: number;
  block_number: number | null;
  planned_sets: unknown;
  jit_strategy: string | null;
  completed_at: string | null;
  program_id: string | null;
}

async function fetchAllProgramSessions(programId: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, status, planned_date, primary_lift, intensity_type, week_number, day_number, block_number, planned_sets, jit_strategy, completed_at, program_id',
    )
    .eq('program_id', programId)
    .order('planned_date', { ascending: true });

  if (error) throw new Error(`sessions query failed: ${error.message}`);
  return (data ?? []) as SessionRow[];
}

function printScheduleOverview(sessions: SessionRow[]) {
  printHeader('5. Schedule Overview');

  const counts: Record<string, number> = {};
  for (const s of sessions) {
    counts[s.status] = (counts[s.status] ?? 0) + 1;
  }

  const statusOrder = ['completed', 'scheduled', 'planned', 'skipped'];
  const allStatuses = [
    ...statusOrder.filter((st) => counts[st] != null),
    ...Object.keys(counts).filter((st) => !statusOrder.includes(st)),
  ];

  console.log('  Status counts:');
  for (const st of allStatuses) {
    console.log(`    ${st.padEnd(12)}: ${counts[st]}`);
  }

  // Next up: earliest non-completed session
  const upcoming = sessions.filter(
    (s) => s.status === 'scheduled' || s.status === 'planned',
  );

  if (upcoming.length === 0) {
    console.log('');
    console.log(yellow('  No scheduled or planned sessions.'));
    warn('No upcoming sessions in schedule.', 'error');
    return;
  }

  const next = upcoming[0];
  const today = new Date().toISOString().slice(0, 10);
  const hasPlannedSets = Array.isArray(next.planned_sets) && (next.planned_sets as unknown[]).length > 0;

  printSubHeader('Next Session');

  const label =
    next.week_number === 0 && next.day_number === 0 ? 'ad-hoc' : `W${next.week_number}/D${next.day_number}/B${next.block_number ?? '?'}`;

  console.log(`  planned_date  : ${fmtDate(next.planned_date)}`);
  console.log(`  primary_lift  : ${next.primary_lift ?? '(none)'}`);
  console.log(`  intensity_type: ${next.intensity_type ?? '(none)'}`);
  console.log(`  position      : ${label}`);
  console.log(`  status        : ${next.status}`);
  console.log(`  jit_strategy  : ${next.jit_strategy ?? '(none)'}`);
  console.log(`  has_planned_sets: ${hasPlannedSets ? 'yes' : yellow('NO')}`);

  if (next.planned_date && next.planned_date < today) {
    warn(`Next session planned_date (${next.planned_date}) is in the past.`);
  }
  if (!hasPlannedSets) {
    warn(`Next session has no planned_sets — JIT has not generated a prescription yet.`);
  }
}

// ---------------------------------------------------------------------------
// Section 6: Recent Completed Sessions
// ---------------------------------------------------------------------------

async function fetchRecentCompletedSessions(
  userId: string,
  programId: string,
  limit = 8,
) {
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select(
      'id, planned_date, completed_at, primary_lift, intensity_type, week_number, day_number, block_number, planned_sets, program_id',
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .eq('program_id', programId)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (sessErr) throw new Error(`sessions query failed: ${sessErr.message}`);
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  const { data: logs, error: logsErr } = await supabase
    .from('session_logs')
    .select('id, session_id, session_rpe, actual_sets, auxiliary_sets, logged_at, performance_vs_plan')
    .in('session_id', sessionIds)
    .eq('is_correction', false);

  if (logsErr) throw new Error(`session_logs query failed: ${logsErr.message}`);

  // Latest non-correction log per session
  const logBySessionId = new Map<string, typeof logs extends (infer T)[] | null ? T : never>();
  for (const log of logs ?? []) {
    const existing = logBySessionId.get(log.session_id);
    if (!existing || log.logged_at > existing.logged_at) {
      logBySessionId.set(log.session_id, log);
    }
  }

  return (sessions as SessionRow[]).map((s) => ({
    session: s,
    log: logBySessionId.get(s.id) ?? null,
  }));
}

function summarizePlanned(sets: PlannedSet[]) {
  if (sets.length === 0) return '—';
  const reps = sets[0].reps;
  const weight = sets[0].weight_kg;
  const rpe = sets[0].rpe_target;
  const rpeStr = rpe != null ? ` RPE${rpe}` : '';
  return `${sets.length}×${reps}@${weight}kg${rpeStr}`;
}

function summarizeActual(sets: ActualSet[]) {
  if (sets.length === 0) return '—';
  const reps = sets[0].reps_completed;
  const weightKg = gramsToKg(sets[0].weight_grams);
  const rpes = sets.map((s) => s.rpe_actual).filter((r): r is number => r != null);
  const rpeStr =
    rpes.length > 0
      ? ` ${Math.min(...rpes)}-${Math.max(...rpes)}`
      : '';
  return `${sets.length}×${reps}@${weightKg}kg${rpeStr}`;
}

async function printRecentSessions(userId: string, program: ProgramRow) {
  printHeader('6. Recent Completed Sessions (last 8)');

  const pairs = await fetchRecentCompletedSessions(userId, program.id);

  if (pairs.length === 0) {
    console.log('  No completed sessions found.');
    return;
  }

  const H = {
    date: 10,
    lift: 10,
    type: 11,
    pos: 8,
    sets: 5,
    planned: 18,
    actual: 18,
    rpe: 6,
    perf: 8,
  };

  const header =
    col('Date', H.date) + ' | ' +
    col('Lift', H.lift) + ' | ' +
    col('Type', H.type) + ' | ' +
    col('W/D/B', H.pos) + ' | ' +
    col('Sets', H.sets) + ' | ' +
    col('Planned', H.planned) + ' | ' +
    col('Actual', H.actual) + ' | ' +
    col('RPE', H.rpe) + ' | ' +
    col('Perf', H.perf);

  console.log('  ' + header);
  console.log('  ' + '─'.repeat(header.length));

  for (const { session, log } of pairs) {
    const date = fmtDate(session.completed_at ?? session.planned_date);
    const lift = session.primary_lift ?? 'n/a';

    const isAdHoc = session.week_number === 0 && session.day_number === 0;
    const pos = isAdHoc
      ? 'ad-hoc'
      : `${session.week_number}/${session.day_number}/${session.block_number ?? '?'}`;

    const planned = parsePlannedSets(session.planned_sets);
    const actual = log ? parseActualSets(log.actual_sets) : [];
    const sessionRpe = log?.session_rpe;
    const perf = log?.performance_vs_plan ?? '—';

    const row =
      col(date, H.date) + ' | ' +
      col(lift, H.lift) + ' | ' +
      col(session.intensity_type ?? '—', H.type) + ' | ' +
      col(pos, H.pos) + ' | ' +
      col(String(planned.length || actual.length), H.sets) + ' | ' +
      col(summarizePlanned(planned), H.planned) + ' | ' +
      col(summarizeActual(actual), H.actual) + ' | ' +
      col(sessionRpe != null ? String(sessionRpe) : '—', H.rpe) + ' | ' +
      col(perf, H.perf);

    console.log('  ' + row);
  }
}

// ---------------------------------------------------------------------------
// Section 7: Auxiliary Work Summary
// ---------------------------------------------------------------------------

async function printAuxSummary(userId: string, program: ProgramRow) {
  printHeader('7. Auxiliary Work Summary (last 5 completed sessions)');

  const pairs = await fetchRecentCompletedSessions(userId, program.id, 5);

  const buckets = new Map<
    string,
    { weights: number[]; reps: number[]; rpes: number[]; sessionCount: number }
  >();

  for (const { log } of pairs) {
    if (!log) continue;
    const auxSets = parseAuxSets(log.auxiliary_sets);
    const seenInSession = new Set<string>();

    for (const s of auxSets) {
      const key = s.exercise;
      if (!buckets.has(key)) {
        buckets.set(key, { weights: [], reps: [], rpes: [], sessionCount: 0 });
      }
      const b = buckets.get(key)!;
      if (!seenInSession.has(key)) {
        b.sessionCount++;
        seenInSession.add(key);
      }
      if (s.weight_grams > 0) b.weights.push(gramsToKg(s.weight_grams));
      b.reps.push(s.reps_completed);
      if (s.rpe_actual != null) b.rpes.push(s.rpe_actual);
    }
  }

  if (buckets.size === 0) {
    console.log('  No auxiliary work logged in last 5 sessions.');
    return;
  }

  const H = { ex: 28, times: 7, weight: 12, reps: 8, rpe: 12 };

  const header =
    col('Exercise', H.ex) + ' | ' +
    col('Times', H.times) + ' | ' +
    col('Avg wt (kg)', H.weight) + ' | ' +
    col('Avg reps', H.reps) + ' | ' +
    col('RPE range', H.rpe);

  console.log('  ' + header);
  console.log('  ' + '─'.repeat(header.length));

  const sorted = [...buckets.entries()].sort((a, b) => b[1].sessionCount - a[1].sessionCount);

  for (const [exercise, b] of sorted) {
    const avgWt = b.weights.length > 0 ? avg(b.weights).toFixed(1) : 'BW';
    const avgReps = b.reps.length > 0 ? avg(b.reps).toFixed(1) : '—';
    const rpeRange =
      b.rpes.length > 0
        ? `${Math.min(...b.rpes)}-${Math.max(...b.rpes)}`
        : '—';

    const row =
      col(exercise, H.ex) + ' | ' +
      col(String(b.sessionCount), H.times) + ' | ' +
      col(String(avgWt), H.weight) + ' | ' +
      col(String(avgReps), H.reps) + ' | ' +
      col(rpeRange, H.rpe);

    console.log('  ' + row);
  }
}

// ---------------------------------------------------------------------------
// Section 8: Flags & Warnings
// ---------------------------------------------------------------------------

function checkScheduleFlags(sessions: SessionRow[]) {
  const today = new Date().toISOString().slice(0, 10);

  // Completed sessions sorted by completed_at
  const completed = sessions
    .filter((s) => s.status === 'completed' && s.completed_at != null)
    .sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''));

  // Check completion order vs planned_date order
  const completedWithPlanned = completed.filter((s) => s.planned_date != null);
  for (let i = 1; i < completedWithPlanned.length; i++) {
    const prev = completedWithPlanned[i - 1];
    const curr = completedWithPlanned[i];
    if (
      prev.planned_date != null &&
      curr.planned_date != null &&
      curr.planned_date < prev.planned_date
    ) {
      warn(
        `Session completed out of planned_date order: completed ${fmtDate(curr.completed_at)} but planned before ${fmtDate(prev.planned_date)}.`,
      );
    }
  }

  // Sessions missing jit_strategy (program sessions that are not ad-hoc)
  const programSessions = sessions.filter(
    (s) =>
      s.program_id != null &&
      !(s.week_number === 0 && s.day_number === 0) &&
      s.status !== 'skipped',
  );
  const missingStrategy = programSessions.filter((s) => s.jit_strategy == null);
  if (missingStrategy.length > 0) {
    warn(
      `${missingStrategy.length} program session(s) have jit_strategy = null (not yet generated or stale).`,
    );
  }

  // Gaps > 3 days between consecutive planned_dates in upcoming sessions
  const upcoming = sessions
    .filter((s) => (s.status === 'scheduled' || s.status === 'planned') && s.planned_date != null)
    .sort((a, b) => (a.planned_date ?? '').localeCompare(b.planned_date ?? ''));

  for (let i = 1; i < upcoming.length; i++) {
    const prevDate = new Date(upcoming[i - 1].planned_date!);
    const currDate = new Date(upcoming[i].planned_date!);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);
    if (diffDays > 3) {
      warn(
        `Schedule gap of ${diffDays} days between ${fmtDate(upcoming[i - 1].planned_date)} and ${fmtDate(upcoming[i].planned_date)}.`,
      );
    }
  }
}

function printFlags() {
  printHeader('8. Flags & Warnings');

  if (warnings.length === 0) {
    console.log('  No issues detected.');
    return;
  }

  for (const w of warnings) {
    console.log(`  ${w}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseUserId() {
  const idx = process.argv.indexOf('--user-id');
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return null;
}

async function main() {
  const argUserId = parseUserId();
  const userId = await resolveUserId(argUserId);

  await printProfile(userId);
  await printLifterMaxes(userId);

  const program = await printActiveProgram(userId);
  await printFormulaConfig(userId);

  if (program) {
    const sessions = await fetchAllProgramSessions(program.id);
    printScheduleOverview(sessions);
    checkScheduleFlags(sessions);
    await printRecentSessions(userId, program);
    await printAuxSummary(userId, program);
  } else {
    // Still print placeholder sections so output is consistent
    printHeader('5. Schedule Overview');
    console.log('  Skipped — no active program.');
    printHeader('6. Recent Completed Sessions (last 8)');
    console.log('  Skipped — no active program.');
    printHeader('7. Auxiliary Work Summary (last 5 completed sessions)');
    console.log('  Skipped — no active program.');
  }

  printFlags();

  console.log('');
  printSeparator();
  console.log('Done.');
  printSeparator();
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});

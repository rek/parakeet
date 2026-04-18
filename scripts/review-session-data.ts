/**
 * Session prescription accuracy diagnostic tool.
 *
 * Queries production Supabase data and outputs a structured analysis of how
 * well the JIT engine's prescriptions match actual training outcomes.
 *
 * Usage:
 *   SUPABASE_URL=https://... \
 *   SUPABASE_SERVICE_KEY=<secret key> \
 *   npx tsx scripts/review-session-data.ts
 *
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
// JSONB shape types (mirrors shared-types schemas and prescription-trace.ts)
// ---------------------------------------------------------------------------

interface PlannedSet {
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe_target?: number;
  reps_range?: [number, number];
}

interface ActualSet {
  set_number: number;
  weight_grams: number;
  reps_completed: number;
  rpe_actual?: number;
  exercise?: string;
  exercise_type?: string;
}

interface AuxSet {
  set_number: number;
  weight_grams: number;
  reps_completed: number;
  rpe_actual?: number;
  exercise: string;
  exercise_type?: string;
}

interface AuxWeightTrace {
  oneRmKg: number;
  catalogPct: number;
  scalingMethod: string;
  rawWeightKg: number;
  sorenessMultiplier: number;
  finalWeightKg: number;
}

interface AuxExerciseTrace {
  exercise: string;
  selectionReason: string;
  weightTrace: AuxWeightTrace | null;
  reps: number;
  sets: number;
  skipped: boolean;
  skipReason?: string;
}

interface PrescriptionTrace {
  sessionId: string;
  primaryLift: string;
  intensityType: string;
  auxiliaries: AuxExerciseTrace[];
}

// ---------------------------------------------------------------------------
// DB row types (what Supabase returns after the join)
// ---------------------------------------------------------------------------

interface SessionRow {
  id: string;
  primary_lift: string | null;
  intensity_type: string | null;
  planned_date: string | null;
  completed_at: string | null;
  planned_sets: unknown;
  jit_output_trace: unknown;
}

interface SessionLogRow {
  id: string;
  session_id: string;
  session_rpe: number | null;
  actual_sets: unknown;
  auxiliary_sets: unknown;
  logged_at: string;
}

interface SessionWithLog {
  session: SessionRow;
  log: SessionLogRow;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gramsToKg(grams: number): number {
  return Math.round((grams / 1000) * 10) / 10;
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
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

function parsePrescriptionTrace(raw: unknown): PrescriptionTrace | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const t = raw as Record<string, unknown>;
  if (!Array.isArray(t['auxiliaries'])) return null;
  return raw as PrescriptionTrace;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function printSeparator(char = '─', width = 72): void {
  console.log(char.repeat(width));
}

function printHeader(title: string): void {
  console.log('');
  printSeparator('═');
  console.log(`  ${title}`);
  printSeparator('═');
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchCompletedSessionsWithLogs(): Promise<SessionWithLog[]> {
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('id, primary_lift, intensity_type, planned_date, completed_at, planned_sets, jit_output_trace')
    .eq('status', 'completed')
    .not('primary_lift', 'is', null)
    .not('planned_sets', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(200);

  if (sessErr) throw new Error(`sessions query failed: ${sessErr.message}`);
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  // Post-durability-rollout (#16): hydrate per-set data from set_logs instead
  // of reading session_logs JSONB (placeholder-only since 2026-04-18).
  const [{ data: logs, error: logsErr }, { data: setLogs, error: setErr }] =
    await Promise.all([
      supabase
        .from('session_logs')
        .select('id, session_id, session_rpe, logged_at')
        .in('session_id', sessionIds)
        .eq('is_correction', false),
      supabase
        .from('set_logs')
        .select(
          'session_id, kind, exercise, set_number, weight_grams, reps_completed, rpe_actual',
        )
        .in('session_id', sessionIds),
    ]);

  if (logsErr) throw new Error(`session_logs query failed: ${logsErr.message}`);
  if (setErr) throw new Error(`set_logs query failed: ${setErr.message}`);

  const primaryBySession = new Map<string, unknown[]>();
  const auxBySession = new Map<string, unknown[]>();
  for (const row of setLogs ?? []) {
    const bucket = row.kind === 'primary' ? primaryBySession : auxBySession;
    if (!bucket.has(row.session_id)) bucket.set(row.session_id, []);
    bucket.get(row.session_id)!.push(row);
  }

  // One log per session: prefer the latest if there are multiple. Stitch
  // set_logs rows back on so downstream parseActualSets / parseAuxSets work.
  const logBySessionId = new Map<string, SessionLogRow>();
  for (const log of logs ?? []) {
    const existing = logBySessionId.get(log.session_id);
    if (!existing || log.logged_at > existing.logged_at) {
      const augmented: SessionLogRow = {
        ...log,
        actual_sets: primaryBySession.get(log.session_id) ?? [],
        auxiliary_sets: auxBySession.get(log.session_id) ?? [],
      };
      logBySessionId.set(log.session_id, augmented);
    }
  }

  const pairs: SessionWithLog[] = [];
  for (const session of sessions as SessionRow[]) {
    const log = logBySessionId.get(session.id);
    if (log) {
      pairs.push({ session, log });
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Section 1: Main Lift Calibration
// ---------------------------------------------------------------------------

interface LiftCalibrationStats {
  lift: string;
  intensityType: string;
  sampleSessions: number;
  avgRpeDeviation: number;
  avgWeightDeviationKg: number;
  repCompletionRate: number;
}

function analyzeMainLiftCalibration(pairs: SessionWithLog[]): LiftCalibrationStats[] {
  // Aggregate per (lift, intensity_type)
  const buckets = new Map<
    string,
    {
      rpeDeviations: number[];
      weightDeviationsKg: number[];
      repsPairs: Array<{ planned: number; actual: number }>;
      sessions: Set<string>;
    }
  >();

  for (const { session, log } of pairs) {
    if (!session.primary_lift || !session.intensity_type) continue;

    const key = `${session.primary_lift}|${session.intensity_type}`;
    if (!buckets.has(key)) {
      buckets.set(key, { rpeDeviations: [], weightDeviationsKg: [], repsPairs: [], sessions: new Set() });
    }
    const bucket = buckets.get(key)!;
    bucket.sessions.add(session.id);

    const planned = parsePlannedSets(session.planned_sets);
    const actual = parseActualSets(log.actual_sets);

    for (const ps of planned) {
      const as = actual.find((a) => a.set_number === ps.set_number);
      if (!as) continue;

      if (ps.rpe_target !== undefined && as.rpe_actual !== undefined) {
        bucket.rpeDeviations.push(as.rpe_actual - ps.rpe_target);
      }

      const plannedGrams = ps.weight_kg * 1000;
      bucket.weightDeviationsKg.push(gramsToKg(as.weight_grams - plannedGrams));

      bucket.repsPairs.push({ planned: ps.reps, actual: as.reps_completed });
    }
  }

  const results: LiftCalibrationStats[] = [];
  for (const [key, bucket] of buckets) {
    const [lift, intensityType] = key.split('|');
    const totalReps = bucket.repsPairs.reduce((s, p) => s + p.planned, 0);
    const completedReps = bucket.repsPairs.reduce((s, p) => s + Math.min(p.actual, p.planned), 0);
    results.push({
      lift,
      intensityType,
      sampleSessions: bucket.sessions.size,
      avgRpeDeviation: avg(bucket.rpeDeviations),
      avgWeightDeviationKg: avg(bucket.weightDeviationsKg),
      repCompletionRate: totalReps > 0 ? completedReps / totalReps : 1,
    });
  }

  return results.sort((a, b) => a.lift.localeCompare(b.lift) || a.intensityType.localeCompare(b.intensityType));
}

function printMainLiftCalibration(pairs: SessionWithLog[]): void {
  printHeader('Section 1: Main Lift Calibration');

  const stats = analyzeMainLiftCalibration(pairs);
  if (stats.length === 0) {
    console.log('  No data.');
    return;
  }

  const col = (s: string, w: number) => s.padEnd(w).slice(0, w);

  console.log(
    col('Lift', 12) +
    col('Intensity', 12) +
    col('Sessions', 10) +
    col('Avg RPE Dev', 13) +
    col('Avg Wt Dev (kg)', 17) +
    col('Rep Completion', 16),
  );
  printSeparator();

  for (const s of stats) {
    const rpeStr = s.avgRpeDeviation === 0 && s.sampleSessions === 0
      ? 'n/a'
      : `${s.avgRpeDeviation >= 0 ? '+' : ''}${fmt(s.avgRpeDeviation)}`;
    const wtStr = `${s.avgWeightDeviationKg >= 0 ? '+' : ''}${fmt(s.avgWeightDeviationKg)} kg`;
    const repStr = `${(s.repCompletionRate * 100).toFixed(1)}%`;

    console.log(
      col(s.lift, 12) +
      col(s.intensityType, 12) +
      col(String(s.sampleSessions), 10) +
      col(rpeStr, 13) +
      col(wtStr, 17) +
      col(repStr, 16),
    );
  }
}

// ---------------------------------------------------------------------------
// Section 2: Aux Exercise Health Report
// ---------------------------------------------------------------------------

interface AuxHealthStats {
  exercise: string;
  totalSets: number;
  avgRpe: number;
  failureRate: number;
  minReps: number;
  maxReps: number;
  avgReps: number;
  avgWeightKg: number;
  hasRpeData: boolean;
}

function analyzeAuxHealth(pairs: SessionWithLog[]): AuxHealthStats[] {
  const buckets = new Map<
    string,
    {
      rpes: number[];
      reps: number[];
      weights: number[];
      failedSets: number;
      totalSets: number;
    }
  >();

  for (const { log } of pairs) {
    const auxSets = parseAuxSets(log.auxiliary_sets);
    for (const s of auxSets) {
      const key = s.exercise;
      if (!buckets.has(key)) {
        buckets.set(key, { rpes: [], reps: [], weights: [], failedSets: 0, totalSets: 0 });
      }
      const b = buckets.get(key)!;
      b.totalSets++;
      b.reps.push(s.reps_completed);
      if (s.weight_grams > 0) b.weights.push(gramsToKg(s.weight_grams));
      if (s.rpe_actual !== undefined) {
        b.rpes.push(s.rpe_actual);
        if (s.rpe_actual >= 9.5) b.failedSets++;
      }
    }
  }

  const results: AuxHealthStats[] = [];
  for (const [exercise, b] of buckets) {
    results.push({
      exercise,
      totalSets: b.totalSets,
      avgRpe: avg(b.rpes),
      failureRate: b.rpes.length > 0 ? b.failedSets / b.rpes.length : 0,
      minReps: b.reps.length > 0 ? Math.min(...b.reps) : 0,
      maxReps: b.reps.length > 0 ? Math.max(...b.reps) : 0,
      avgReps: avg(b.reps),
      avgWeightKg: avg(b.weights),
      hasRpeData: b.rpes.length > 0,
    });
  }

  return results.sort((a, b) => b.totalSets - a.totalSets);
}

function printAuxHealth(pairs: SessionWithLog[]): void {
  printHeader('Section 2: Aux Exercise Health Report');

  const stats = analyzeAuxHealth(pairs);
  if (stats.length === 0) {
    console.log('  No aux data.');
    return;
  }

  const col = (s: string, w: number) => s.padEnd(w).slice(0, w);

  console.log(
    col('Exercise', 28) +
    col('Sets', 7) +
    col('Avg RPE', 10) +
    col('Fail%', 8) +
    col('Reps (min/avg/max)', 22) +
    col('Avg Wt (kg)', 13),
  );
  printSeparator();

  for (const s of stats) {
    const flag =
      (s.hasRpeData && s.avgRpe > 9.0) || s.failureRate > 0.2 ? ' ⚠️' : '';
    const rpeStr = s.hasRpeData ? fmt(s.avgRpe) : 'n/a';
    const failStr = s.hasRpeData ? `${(s.failureRate * 100).toFixed(0)}%` : 'n/a';
    const repsStr = `${s.minReps}/${fmt(s.avgReps, 1)}/${s.maxReps}`;
    const wtStr = s.avgWeightKg > 0 ? fmt(s.avgWeightKg) : 'BW';

    console.log(
      col(s.exercise + flag, 30) +
      col(String(s.totalSets), 7) +
      col(rpeStr, 10) +
      col(failStr, 8) +
      col(repsStr, 22) +
      col(wtStr, 13),
    );
  }
}

// ---------------------------------------------------------------------------
// Section 3: Session Fatigue Cascade
// ---------------------------------------------------------------------------

interface FatigueCascadeRow {
  date: string;
  lift: string;
  intensityType: string;
  sessionRpe: number;
  avgMainRpe: number;
  gap: number;
  highRpeAuxCount: number;
  flagged: boolean;
}

function analyzeSessionFatigue(pairs: SessionWithLog[]): FatigueCascadeRow[] {
  const rows: FatigueCascadeRow[] = [];

  for (const { session, log } of pairs) {
    if (!log.session_rpe) continue;
    if (!session.primary_lift || !session.intensity_type) continue;

    const actual = parseActualSets(log.actual_sets);
    const mainRpes = actual
      .map((s) => s.rpe_actual)
      .filter((r): r is number => r !== undefined);

    if (mainRpes.length === 0) continue;

    const auxSets = parseAuxSets(log.auxiliary_sets);
    const highRpeAuxCount = auxSets.filter(
      (s) => s.rpe_actual !== undefined && s.rpe_actual >= 9.5,
    ).length;

    const avgMainRpe = avg(mainRpes);
    const gap = log.session_rpe - avgMainRpe;

    rows.push({
      date: (session.completed_at ?? session.planned_date ?? '').slice(0, 10),
      lift: session.primary_lift,
      intensityType: session.intensity_type,
      sessionRpe: log.session_rpe,
      avgMainRpe,
      gap,
      highRpeAuxCount,
      flagged: gap > 1.0,
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

function printFatigueCascade(pairs: SessionWithLog[]): void {
  printHeader('Section 3: Session Fatigue Cascade');

  const rows = analyzeSessionFatigue(pairs);
  if (rows.length === 0) {
    console.log('  No sessions with both session_rpe and set-level RPE.');
    return;
  }

  const col = (s: string, w: number) => s.padEnd(w).slice(0, w);

  console.log(
    col('Date', 12) +
    col('Lift', 12) +
    col('Intensity', 12) +
    col('Sess RPE', 10) +
    col('Avg Main RPE', 14) +
    col('Gap', 8) +
    col('Hi-RPE Aux', 12),
  );
  printSeparator();

  for (const r of rows) {
    const flag = r.flagged ? ' ⚠️' : '';
    console.log(
      col(r.date, 12) +
      col(r.lift, 12) +
      col(r.intensityType, 12) +
      col(fmt(r.sessionRpe, 1), 10) +
      col(fmt(r.avgMainRpe, 1), 14) +
      col(`${r.gap >= 0 ? '+' : ''}${fmt(r.gap, 1)}${flag}`, 12) +
      col(String(r.highRpeAuxCount), 12),
    );
  }
}

// ---------------------------------------------------------------------------
// Section 4: Weight Prescription Accuracy (aux)
// ---------------------------------------------------------------------------

interface AuxWeightAccuracyRow {
  exercise: string;
  prescribedKg: number;
  actualKg: number;
  ratio: number;
  sampleCount: number;
  flagged: boolean;
}

function analyzeAuxWeightAccuracy(pairs: SessionWithLog[]): AuxWeightAccuracyRow[] {
  // Aggregate prescribed vs actual per exercise
  const buckets = new Map<
    string,
    { prescribed: number[]; actual: number[] }
  >();

  for (const { session, log } of pairs) {
    const trace = parsePrescriptionTrace(session.jit_output_trace);
    if (!trace) continue;

    const auxSets = parseAuxSets(log.auxiliary_sets);
    if (auxSets.length === 0) continue;

    for (const auxTrace of trace.auxiliaries) {
      if (auxTrace.skipped || !auxTrace.weightTrace) continue;
      const prescribedKg = auxTrace.weightTrace.finalWeightKg;
      if (prescribedKg <= 0) continue;

      const matchingSets = auxSets.filter((s) => s.exercise === auxTrace.exercise);
      const actualWeights = matchingSets
        .map((s) => gramsToKg(s.weight_grams))
        .filter((w) => w > 0);

      if (actualWeights.length === 0) continue;

      if (!buckets.has(auxTrace.exercise)) {
        buckets.set(auxTrace.exercise, { prescribed: [], actual: [] });
      }
      const b = buckets.get(auxTrace.exercise)!;
      // One prescribed weight per session, average actual
      b.prescribed.push(prescribedKg);
      b.actual.push(avg(actualWeights));
    }
  }

  const rows: AuxWeightAccuracyRow[] = [];
  for (const [exercise, b] of buckets) {
    const avgPrescribed = avg(b.prescribed);
    const avgActual = avg(b.actual);
    const ratio = avgPrescribed > 0 ? avgActual / avgPrescribed : 1;
    rows.push({
      exercise,
      prescribedKg: avgPrescribed,
      actualKg: avgActual,
      ratio,
      sampleCount: b.prescribed.length,
      flagged: ratio < 0.6,
    });
  }

  return rows.sort((a, b) => a.ratio - b.ratio);
}

function printAuxWeightAccuracy(pairs: SessionWithLog[]): void {
  printHeader('Section 4: Weight Prescription Accuracy (Aux)');

  const rows = analyzeAuxWeightAccuracy(pairs);
  if (rows.length === 0) {
    console.log('  No aux prescription trace data available.');
    return;
  }

  const col = (s: string, w: number) => s.padEnd(w).slice(0, w);

  console.log(
    col('Exercise', 28) +
    col('Samples', 9) +
    col('Prescribed (kg)', 17) +
    col('Actual (kg)', 13) +
    col('Ratio', 10),
  );
  printSeparator();

  for (const r of rows) {
    const flag = r.flagged ? ' ⚠️  LOW' : '';
    console.log(
      col(r.exercise, 28) +
      col(String(r.sampleCount), 9) +
      col(fmt(r.prescribedKg), 17) +
      col(fmt(r.actualKg), 13) +
      col(`${fmt(r.ratio, 2)}${flag}`, 18),
    );
  }
}

// ---------------------------------------------------------------------------
// Section 5: Auto-Recommendations
// ---------------------------------------------------------------------------

function printRecommendations(pairs: SessionWithLog[]): void {
  printHeader('Section 5: Auto-Recommendations');

  const auxHealth = analyzeAuxHealth(pairs);
  const weightAccuracy = analyzeAuxWeightAccuracy(pairs);
  const fatigue = analyzeSessionFatigue(pairs);

  const recommendations: string[] = [];

  // Weight prescription underuse
  const underPrescribed = weightAccuracy.filter((r) => r.flagged);
  if (underPrescribed.length > 0) {
    recommendations.push('WEIGHT PRESCRIPTION — exercises where actual weight is < 60% of prescribed:');
    for (const r of underPrescribed) {
      recommendations.push(
        `  - ${r.exercise}: prescribed ${fmt(r.prescribedKg)} kg, actual ${fmt(r.actualKg)} kg (ratio ${fmt(r.ratio, 2)})` +
        ` — consider reducing weightPct in exercise catalog`,
      );
    }
  }

  // Chronic high RPE aux exercises
  const highRpeAux = auxHealth.filter((s) => s.hasRpeData && s.avgRpe > 9.0);
  if (highRpeAux.length > 0) {
    recommendations.push('CHRONIC HIGH RPE — aux exercises averaging RPE > 9.0:');
    for (const s of highRpeAux) {
      recommendations.push(
        `  - ${s.exercise}: avg RPE ${fmt(s.avgRpe)} across ${s.totalSets} sets` +
        ` — reduce prescribed weight or target reps`,
      );
    }
  }

  // High failure rate aux exercises
  const highFailure = auxHealth.filter((s) => s.hasRpeData && s.failureRate > 0.2 && s.avgRpe <= 9.0);
  if (highFailure.length > 0) {
    recommendations.push('HIGH FAILURE RATE — aux exercises with > 20% sets at RPE >= 9.5:');
    for (const s of highFailure) {
      recommendations.push(
        `  - ${s.exercise}: ${(s.failureRate * 100).toFixed(0)}% failure rate across ${s.totalSets} sets`,
      );
    }
  }

  // Fatigue cascade sessions
  const cascadeSessions = fatigue.filter((r) => r.flagged);
  if (cascadeSessions.length > 0) {
    const cascadeCount = cascadeSessions.length;
    const avgGap = avg(cascadeSessions.map((r) => r.gap));
    recommendations.push(
      `FATIGUE CASCADE — ${cascadeCount} session(s) where session RPE exceeded avg main lift RPE by > 1.0:`,
    );
    recommendations.push(
      `  Average gap in flagged sessions: +${fmt(avgGap, 1)} RPE units.` +
      ` Consider reducing aux volume or intensity on heavy/explosive days.`,
    );

    // Break down by lift
    const byLift = new Map<string, number>();
    for (const r of cascadeSessions) {
      byLift.set(r.lift, (byLift.get(r.lift) ?? 0) + 1);
    }
    for (const [lift, count] of byLift) {
      recommendations.push(`  - ${lift}: ${count} flagged session(s)`);
    }
  }

  if (recommendations.length === 0) {
    console.log('  No issues detected. Prescription accuracy looks healthy.');
  } else {
    for (const line of recommendations) {
      console.log(line);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Fetching session data from Supabase...');
  const pairs = await fetchCompletedSessionsWithLogs();
  console.log(`Loaded ${pairs.length} completed sessions with logs.`);

  printMainLiftCalibration(pairs);
  printAuxHealth(pairs);
  printFatigueCascade(pairs);
  printAuxWeightAccuracy(pairs);
  printRecommendations(pairs);

  console.log('');
  printSeparator();
  console.log('Done.');
  printSeparator();
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});

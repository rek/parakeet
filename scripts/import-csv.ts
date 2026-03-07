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

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as readline from 'readline'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActualSet {
  set_number: number
  weight_grams: number
  reps_completed: number
  rpe_actual?: number
}

interface ParsedRow {
  date: string        // ISO date string YYYY-MM-DD
  datetime: string    // full ISO timestamp
  exerciseName: string
  setOrder: number
  weightKg: number
  reps: number
  rpe?: number
}

interface MappedSession {
  date: string
  datetime: string
  lift: string
  sets: ActualSet[]
}

// ---------------------------------------------------------------------------
// Exercise mapping
// ---------------------------------------------------------------------------

const CANONICAL_LIFTS: Record<string, string[]> = {
  squat:          ['squat', 'back squat', 'low bar', 'high bar'],
  bench:          ['bench', 'bench press', 'chest press'],
  deadlift:       ['deadlift', 'dead lift', 'conventional', 'sumo'],
  overhead_press: ['overhead press', 'ohp', 'shoulder press', 'military press'],
}

function autoSuggest(exerciseName: string): string | null {
  // Strip parenthetical qualifiers like "(Barbell)", "(DB)"
  const cleaned = exerciseName.replace(/\s*\(.*?\)/g, '').toLowerCase().trim()
  for (const [lift, keywords] of Object.entries(CANONICAL_LIFTS)) {
    if (keywords.some((kw) => cleaned.includes(kw))) return lift
  }
  return null
}

// ---------------------------------------------------------------------------
// CSV parsing — auto-detects format from header
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

type CsvFormat = 'strong' | 'nextset'

function detectFormat(header: string[]): CsvFormat {
  if (header.includes('iscompleted') || header.includes('group')) return 'nextset'
  if (header.includes('exercise_name') || header.includes('set_order')) return 'strong'
  throw new Error('Unrecognised CSV format. Expected Strong or NextSet export.')
}

/**
 * NextSet format: Date,Group,Exercise,Reps,Weight,IsCompleted,IsAMRAP,Notes
 * - No set order: derived from row sequence within each date+exercise
 * - IsCompleted: skip rows where false
 * - Weight: kg decimal
 * - No time in Date field
 */
function parseNextSet(lines: string[], header: string[]): ParsedRow[] {
  const idx = (name: string) => header.indexOf(name)
  const dateIdx        = idx('date')
  const exerciseIdx    = idx('exercise')
  const repsIdx        = idx('reps')
  const weightIdx      = idx('weight')
  const completedIdx   = idx('iscompleted')

  if ([dateIdx, exerciseIdx, repsIdx, weightIdx].some((i) => i === -1)) {
    throw new Error('NextSet CSV missing required columns: Date, Exercise, Reps, Weight')
  }

  const rows: ParsedRow[] = []
  let skipped = 0
  // Track set number per date+exercise group
  const setCounters = new Map<string, number>()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const fields = parseCSVLine(line)

    const rawDate     = fields[dateIdx] ?? ''
    const rawExercise = fields[exerciseIdx] ?? ''
    const rawWeight   = fields[weightIdx] ?? ''
    const rawReps     = fields[repsIdx] ?? ''
    const rawCompleted = completedIdx !== -1 ? (fields[completedIdx] ?? 'true') : 'true'

    // Skip incomplete sets
    if (rawCompleted.toLowerCase() === 'false') {
      skipped++
      continue
    }

    if (!rawDate || !/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      skipped++
      continue
    }

    const weight = parseFloat(rawWeight)
    const reps   = parseInt(rawReps, 10)

    if (!rawExercise || isNaN(weight) || isNaN(reps) || weight <= 0 || reps <= 0) {
      skipped++
      continue
    }

    const key = `${rawDate}::${rawExercise}`
    const setOrder = (setCounters.get(key) ?? 0) + 1
    setCounters.set(key, setOrder)

    rows.push({
      date: rawDate,
      datetime: `${rawDate}T12:00:00Z`,
      exerciseName: rawExercise,
      setOrder,
      weightKg: weight,
      reps,
      rpe: undefined,
    })
  }

  if (skipped > 0) console.log(`  Skipped ${skipped} rows (incomplete or unparseable).`)
  return rows
}

/**
 * Strong format: Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes
 * - Date includes time: "2024-01-15 09:30:00"
 */
function parseStrong(lines: string[], header: string[]): ParsedRow[] {
  const idx = (name: string) => header.indexOf(name)
  const dateIdx      = idx('date')
  const exerciseIdx  = idx('exercise_name')
  const setOrderIdx  = idx('set_order')
  const weightIdx    = idx('weight')
  const repsIdx      = idx('reps')
  const rpeIdx       = idx('rpe')

  if ([dateIdx, exerciseIdx, setOrderIdx, weightIdx, repsIdx].some((i) => i === -1)) {
    throw new Error('Strong CSV missing required columns: Date, Exercise Name, Set Order, Weight, Reps')
  }

  const rows: ParsedRow[] = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const fields = parseCSVLine(line)

    const rawDate     = fields[dateIdx] ?? ''
    const rawExercise = fields[exerciseIdx] ?? ''
    const rawSetOrder = fields[setOrderIdx] ?? ''
    const rawWeight   = fields[weightIdx] ?? ''
    const rawReps     = fields[repsIdx] ?? ''
    const rawRpe      = rpeIdx !== -1 ? (fields[rpeIdx] ?? '') : ''

    const dateParts = rawDate.split(' ')
    const dateOnly  = dateParts[0]
    if (!dateOnly || !/^\d{4}-\d{2}-\d{2}/.test(dateOnly)) { skipped++; continue }

    const setOrder = parseInt(rawSetOrder, 10)
    const weight   = parseFloat(rawWeight)
    const reps     = parseInt(rawReps, 10)

    if (!rawExercise || isNaN(setOrder) || isNaN(weight) || isNaN(reps)) { skipped++; continue }
    if (weight <= 0 || reps <= 0) { skipped++; continue }

    const timePart = dateParts[1] ?? '12:00:00'
    const rpe = rawRpe ? parseFloat(rawRpe) : undefined

    rows.push({
      date: dateOnly,
      datetime: `${dateOnly}T${timePart}Z`,
      exerciseName: rawExercise,
      setOrder,
      weightKg: weight,
      reps,
      rpe: rpe && !isNaN(rpe) ? rpe : undefined,
    })
  }

  if (skipped > 0) console.log(`  Skipped ${skipped} unparseable rows.`)
  return rows
}

function parseCSV(content: string): { rows: ParsedRow[]; format: CsvFormat } {
  const lines = content.split('\n').map((l) => l.trimEnd())
  if (lines.length < 2) return { rows: [], format: 'strong' }

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'))
  const format = detectFormat(header)
  const rows = format === 'nextset'
    ? parseNextSet(lines, header)
    : parseStrong(lines, header)

  return { rows, format }
}

// ---------------------------------------------------------------------------
// Interactive exercise mapping
// ---------------------------------------------------------------------------

async function mapExercises(
  exerciseNames: string[],
  rl: readline.Interface
): Promise<Map<string, string | null>> {
  const mapping = new Map<string, string | null>()

  console.log('\nMap each exercise to a canonical lift key.')
  console.log('Valid keys: squat, bench, deadlift, overhead_press')
  console.log('Press Enter to accept suggestion, type a key, or type "skip".\n')

  for (const name of exerciseNames) {
    const suggestion = autoSuggest(name)
    const prompt = suggestion
      ? `  "${name}" → [${suggestion}]: `
      : `  "${name}" → [no suggestion, type key or skip]: `

    const answer = await new Promise<string>((resolve) => {
      rl.question(prompt, resolve)
    })

    const trimmed = answer.trim().toLowerCase()

    if (trimmed === 'skip') {
      mapping.set(name, null)
    } else if (trimmed === '') {
      mapping.set(name, suggestion)
    } else {
      mapping.set(name, trimmed)
    }
  }

  return mapping
}

// ---------------------------------------------------------------------------
// Weight conversion
// ---------------------------------------------------------------------------

function toGrams(weightKg: number, unit: 'kg' | 'lbs'): number {
  if (unit === 'lbs') {
    return Math.round(weightKg * 453.592)
  }
  return Math.round(weightKg * 1000)
}

// ---------------------------------------------------------------------------
// Build sessions from parsed rows + mapping
// ---------------------------------------------------------------------------

function buildSessions(
  rows: ParsedRow[],
  mapping: Map<string, string | null>,
  unit: 'kg' | 'lbs'
): { sessions: MappedSession[]; skippedSets: number } {
  // Group by date+lift
  const groups = new Map<string, MappedSession>()
  let skippedSets = 0

  for (const row of rows) {
    const lift = mapping.get(row.exerciseName)
    if (!lift) {
      skippedSets++
      continue
    }

    const key = `${row.date}::${lift}`
    if (!groups.has(key)) {
      groups.set(key, { date: row.date, datetime: row.datetime, lift, sets: [] })
    }

    const session = groups.get(key)!
    session.sets.push({
      set_number: row.setOrder,
      weight_grams: toGrams(row.weightKg, unit),
      reps_completed: row.reps,
      rpe_actual: row.rpe,
    })
  }

  return { sessions: Array.from(groups.values()), skippedSets }
}

// ---------------------------------------------------------------------------
// Supabase insert
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertSessions(
  supabase: any,
  userId: string,
  sessions: MappedSession[]
): Promise<{ insertedSessions: number; insertedLogs: number }> {
  // Cast to any — createClient without Database generic resolves table types to never.
  // This is a CLI script; runtime correctness is verified by the migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  let insertedSessions = 0
  let insertedLogs = 0

  for (const session of sessions) {
    // Insert session row
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
      .single()

    if (sessionErr) throw new Error(`Session insert failed: ${sessionErr.message}`)
    insertedSessions++

    // Insert session_log row
    const { error: logErr } = await db
      .from('session_logs')
      .insert({
        session_id: sessionRow.id,
        user_id: userId,
        actual_sets: session.sets,
        auxiliary_sets: null,
        session_rpe: null,
        completion_pct: 100,
        performance_vs_plan: 'at',
        started_at: null,
        completed_at: session.datetime,
      })

    if (logErr) throw new Error(`Session log insert failed: ${logErr.message}`)
    insertedLogs++
  }

  return { insertedSessions, insertedLogs }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : undefined
  }

  const filePath  = get('--file')
  const userId    = get('--user-id')
  const unitArg   = get('--unit') as 'kg' | 'lbs' | undefined
  const isDryRun  = args.includes('--dry-run')

  const supabaseUrl = process.env['SUPABASE_URL']
  const serviceKey  = process.env['SUPABASE_SERVICE_KEY']

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
    `)
    process.exit(1)
  }

  const unit: 'kg' | 'lbs' = unitArg === 'lbs' ? 'lbs' : 'kg'

  // Parse CSV
  console.log(`\nParsing ${filePath} (unit: ${unit})...`)
  const content = fs.readFileSync(filePath, 'utf-8')
  const { rows, format } = parseCSV(content)
  console.log(`  Detected format: ${format}`)

  if (rows.length === 0) {
    console.log('No parseable rows found. Exiting.')
    process.exit(0)
  }

  const uniqueExercises = [...new Set(rows.map((r) => r.exerciseName))].sort()
  const dateRange = [rows[0].date, rows[rows.length - 1].date]

  console.log(`\nFound:`)
  console.log(`  ${rows.length} sets across ${uniqueExercises.length} exercise(s)`)
  console.log(`  Date range: ${dateRange[0]} → ${dateRange[1]}`)

  // Interactive exercise mapping
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const mapping = await mapExercises(uniqueExercises, rl)
  rl.close()

  const mappedCount  = [...mapping.values()].filter(Boolean).length
  const skippedCount = [...mapping.values()].filter((v) => v === null).length
  console.log(`\nMapped: ${mappedCount} / ${uniqueExercises.length} exercises (${skippedCount} skipped)`)

  const { sessions, skippedSets } = buildSessions(rows, mapping, unit)

  console.log(`\nDry run summary:`)
  console.log(`  Sessions to insert: ${sessions.length}`)
  console.log(`  Total sets:         ${sessions.reduce((n, s) => n + s.sets.length, 0)}`)
  if (skippedSets > 0) console.log(`  Skipped sets:       ${skippedSets}`)

  if (isDryRun) {
    console.log('\n--dry-run flag set. No data was written.')
    process.exit(0)
  }

  // Confirm
  const confirm = await new Promise<string>((resolve) => {
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl2.question('\nImport? [y/N]: ', (ans) => { rl2.close(); resolve(ans) })
  })

  if (confirm.trim().toLowerCase() !== 'y') {
    console.log('Aborted.')
    process.exit(0)
  }

  // Insert — createClient<any> avoids generic resolution issues in CLI context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient<any>(supabaseUrl, serviceKey)
  console.log('\nInserting...')

  const { insertedSessions, insertedLogs } = await insertSessions(supabase, userId, sessions)

  console.log(`\nDone.`)
  console.log(`  Sessions inserted: ${insertedSessions}`)
  console.log(`  Logs inserted:     ${insertedLogs}`)
}

main().catch((err) => {
  console.error('\nError:', err.message)
  process.exit(1)
})

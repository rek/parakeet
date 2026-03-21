/**
 * One-time backfill: regenerates jit_output_trace for historical sessions
 * that have jit_input_snapshot stored but no trace.
 *
 * Usage:
 *   SUPABASE_URL=https://xfjttjhfmwkhlmienxap.supabase.co \
 *   SUPABASE_SERVICE_KEY=<secret> \
 *   npx tsx scripts/backfill-traces.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { generateJITSessionWithTrace } from '../../packages/training-engine/src/generator/jit-session-generator';
import type { JITInput } from '../../packages/training-engine/src/generator/jit-session-generator';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_KEY'];

  if (!supabaseUrl || !serviceKey) {
    console.error(`
Usage:
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \\
  npx tsx scripts/backfill-traces.ts [--dry-run]

Get the service key from: npx supabase status  (the "Secret" key)
    `);
    process.exit(1);
  }

  if (isDryRun) {
    console.log('[dry-run] No data will be written.\n');
  }

  // Service-role client: persistSession/autoRefreshToken must be off in Node
  // so the client uses the service key directly (bypasses RLS).
  const supabase = createClient<any>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Debug: verify service-role access
  const { count, error: countError } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true });
  console.log(`Total sessions visible: ${count ?? 0}${countError ? ` (error: ${countError.message})` : ''}`);

  // Fetch all sessions with a snapshot, filter in JS to avoid filter quirks.
  const { data: allSessions, error } = await supabase
    .from('sessions')
    .select('id, jit_input_snapshot, jit_output_trace');

  if (error) {
    console.error('Failed to query sessions:', error.message);
    process.exit(1);
  }

  const sessions = (allSessions ?? []).filter(
    (s: any) => s.jit_input_snapshot != null && s.jit_output_trace == null
  );

  const total = sessions.length;
  console.log(`Found ${total} session(s) with a snapshot but no trace.`);

  if (total === 0) {
    console.log('Nothing to do.');
    return;
  }

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const session of sessions) {
    const snapshot = session.jit_input_snapshot as JITInput;
    const primaryLift = snapshot?.primaryLift ?? '(unknown)';

    try {
      const { trace } = generateJITSessionWithTrace(snapshot);

      if (isDryRun) {
        console.log(`  [dry-run] ${session.id}  lift=${primaryLift}`);
        skipped++;
      } else {
        const { error: updateError } = await supabase
          .from('sessions')
          .update({ jit_output_trace: trace })
          .eq('id', session.id);

        if (updateError) {
          console.error(
            `  [error]   ${session.id}  lift=${primaryLift}  — ${updateError.message}`
          );
          failed++;
        } else {
          console.log(`  [ok]      ${session.id}  lift=${primaryLift}`);
          processed++;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `  [error]   ${session.id}  lift=${primaryLift}  — ${message}`
      );
      failed++;
    }
  }

  console.log('\nSummary:');
  console.log(`  Found:     ${total}`);
  if (isDryRun) {
    console.log(`  Skipped:   ${skipped}  (dry-run)`);
    console.log(`  Failed:    ${failed}`);
  } else {
    console.log(`  Updated:   ${processed}`);
    console.log(`  Failed:    ${failed}`);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

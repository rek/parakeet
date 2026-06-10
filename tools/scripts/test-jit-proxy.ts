/**
 * Probe the hosted ai-proxy + LLMJITGenerator end-to-end without writing to DB.
 *
 * Run:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
 *   TEST_EMAIL=... TEST_PASSWORD=... \
 *   RUNS=5 npx tsx tools/scripts/test-jit-proxy.ts
 *
 * Reports per-attempt jit_strategy ('llm' = success, 'formula_fallback' = bug)
 * and elapsed time. Use to validate the 12s-timeout + retry fix lands a real
 * llm result against hosted proxy cold-start.
 */
import { createClient } from '@supabase/supabase-js';

import { configureAIProxy } from '../../packages/training-engine/src/ai/models';
import { DEFAULT_FORMULA_CONFIG_MALE } from '../../packages/training-engine/src/cube/blocks';
import type { JITInput } from '../../packages/training-engine/src/generator/jit-session-generator';
import { LLMJITGenerator } from '../../packages/training-engine/src/generator/llm-jit-generator';
import { DEFAULT_MRV_MEV_CONFIG_MALE } from '../../packages/training-engine/src/volume/mrv-mev-calculator';

const SUPABASE_URL = required('SUPABASE_URL');
const SUPABASE_ANON_KEY = required('SUPABASE_ANON_KEY');
const TEST_EMAIL = required('TEST_EMAIL');
const TEST_PASSWORD = required('TEST_PASSWORD');
const RUNS = Number(process.env.RUNS ?? '5');

function required(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing env var: ${key}`);
    process.exit(1);
  }
  return v;
}

function buildInput(): JITInput {
  return {
    sessionId: `probe-${Date.now()}`,
    weekNumber: 1,
    blockNumber: 1,
    primaryLift: 'squat',
    intensityType: 'heavy',
    oneRmKg: 140,
    formulaConfig: DEFAULT_FORMULA_CONFIG_MALE,
    sorenessRatings: {},
    weeklyVolumeToDate: {},
    mrvMevConfig: DEFAULT_MRV_MEV_CONFIG_MALE,
    activeAuxiliaries: ['Pause Squat', 'Barbell Box Squat'],
    recentLogs: [],
    activeDisruptions: [],
    warmupConfig: { type: 'preset', name: 'standard' },
  };
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  console.log(`Signing in as ${TEST_EMAIL}…`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error || !data.session) {
    console.error('Sign-in failed:', error?.message);
    process.exit(1);
  }
  const token = data.session.access_token;

  configureAIProxy({
    proxyBaseURL: `${SUPABASE_URL}/functions/v1/ai-proxy`,
    authTokenProvider: async () => token,
  });

  console.log(`Running ${RUNS} JIT generations against hosted proxy…\n`);

  const generator = new LLMJITGenerator();
  const results: Array<{
    ok: boolean;
    strategy: string;
    ms: number;
    err?: string;
  }> = [];

  for (let i = 1; i <= RUNS; i++) {
    const start = Date.now();
    try {
      const out = await generator.generate(buildInput());
      const ms = Date.now() - start;
      results.push({ ok: true, strategy: out.jit_strategy ?? 'unknown', ms });
      const tag =
        out.jit_strategy === 'llm' ? '✓ llm' : `✗ ${out.jit_strategy}`;
      console.log(`#${i}  ${ms}ms  ${tag}`);
    } catch (e) {
      const ms = Date.now() - start;
      const err = e instanceof Error ? e.message : String(e);
      results.push({ ok: false, strategy: 'throw', ms, err });
      console.log(`#${i}  ${ms}ms  THROW  ${err}`);
    }
  }

  await supabase.auth.signOut();

  const llm = results.filter((r) => r.strategy === 'llm').length;
  const fallback = results.filter(
    (r) => r.strategy === 'formula_fallback'
  ).length;
  const threw = results.filter((r) => !r.ok).length;
  const avgMs = Math.round(
    results.reduce((s, r) => s + r.ms, 0) / Math.max(1, results.length)
  );

  console.log(
    `\nllm=${llm}  formula_fallback=${fallback}  threw=${threw}  avg=${avgMs}ms`
  );
  process.exit(llm === RUNS ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

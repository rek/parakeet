import { getProfile } from '@modules/profile';
import { JIT_MODEL } from '@parakeet/training-engine';
import type { Json } from '@platform/supabase';
import { typedSupabase } from '@platform/supabase';
import { generateText } from 'ai';

export interface MotivationalContext {
  primaryLifts: string[];
  intensityTypes: string[];
  weekNumber: number;
  blockNumber: number | null;
  isDeload: boolean;
  sessionRpe: number | null;
  performanceVsPlan: 'under' | 'at' | 'over' | 'incomplete' | null;
  newPRs: Array<{ lift: string; prType: string }>;
  currentStreak: number;
  biologicalSex: 'female' | 'male' | null;
  cyclePhase: string | null;
  // Performance detail
  completionPct: number | null;
  topWeightKg: number | null;
  totalSetsCompleted: number;
}

export interface CompletedSessionRef {
  id: string;
  primary_lift: string;
  intensity_type: string;
  week_number: number;
  block_number: number | null;
  is_deload: boolean;
}

export async function fetchMotivationalContext(
  sessions: CompletedSessionRef[],
  currentStreak: number,
  cyclePhase: string | null
): Promise<MotivationalContext> {
  const sessionIds = sessions.map((s) => s.id);

  const [logsResult, prsResult, profile] = await Promise.all([
    typedSupabase
      .from('session_logs')
      .select('session_rpe, performance_vs_plan, actual_sets, completion_pct')
      .in('session_id', sessionIds),
    typedSupabase
      .from('personal_records')
      .select('lift, pr_type')
      .in('session_id', sessionIds),
    getProfile(),
  ]);

  const logs = logsResult.data ?? [];

  // Take the highest RPE across all sessions logged today
  const sessionRpe = logs.reduce<number | null>(
    (max, row) => {
      const rpe = row.session_rpe as number | null;
      if (rpe == null) return max;
      return max == null ? rpe : Math.max(max, rpe);
    },
    null
  );

  const performanceVsPlan =
    (logs[0]?.performance_vs_plan as
      | 'under'
      | 'at'
      | 'over'
      | 'incomplete'
      | null) ?? null;

  // Average completion % across all session logs
  const completionPcts = logs
    .map((r) => r.completion_pct as number | null)
    .filter((v): v is number => v != null);
  const completionPct =
    completionPcts.length > 0
      ? Math.round(completionPcts.reduce((a, b) => a + b, 0) / completionPcts.length)
      : null;

  // Flatten all actual_sets across sessions to derive top weight and set count
  const allSets = logs.flatMap((r) => {
    const raw = r.actual_sets;
    return Array.isArray(raw)
      ? (raw as Array<{ weight_grams?: number; reps_completed?: number }>)
      : [];
  });
  const totalSetsCompleted = allSets.length;
  const maxGrams = allSets.reduce<number | null>((max, s) => {
    const g = s.weight_grams;
    if (g == null) return max;
    return max == null ? g : Math.max(max, g);
  }, null);
  const topWeightKg = maxGrams != null ? Math.round(maxGrams / 1000) : null;

  const newPRs = (prsResult.data ?? []).map((row) => ({
    lift: row.lift as string,
    prType: row.pr_type as string,
  }));

  return {
    primaryLifts: sessions.map((s) => s.primary_lift),
    intensityTypes: sessions.map((s) => s.intensity_type),
    weekNumber: sessions[0]?.week_number ?? 1,
    blockNumber: sessions[0]?.block_number ?? null,
    isDeload: sessions[0]?.is_deload ?? false,
    sessionRpe,
    performanceVsPlan,
    newPRs,
    currentStreak,
    biologicalSex: profile?.biological_sex ?? null,
    cyclePhase,
    completionPct,
    topWeightKg,
    totalSetsCompleted,
  };
}

const SYSTEM_PROMPT = `You are a concise, encouraging powerlifting coach writing a post-workout message for an athlete. Keep it to 1-2 sentences. Use specific, athletic language — not generic gym-speak.

Priority rules (apply the highest matching rule first):
1. If newPRs is non-empty: lead with praise for the personal record, naming the lift and PR type (e.g. "new estimated 1RM")
2. If sessionRpe >= 9: acknowledge the grit required; you may reference the top weight (topWeightKg) if non-null
3. If performanceVsPlan is "over": note the overdelivery, keep the athlete grounded but proud; reference topWeightKg if relevant
4. If performanceVsPlan is "under" or completionPct < 80: gently reinforce that consistency beats any single heroic effort
5. If isDeload is true: praise the discipline and intelligence of intentionally backing off

Secondary context (weave in if space allows):
- If topWeightKg is non-null: you may reference the actual weight lifted to make the message specific (e.g. "moving Xkg")
- If totalSetsCompleted is notable (high volume): briefly acknowledge the work done
- If currentStreak >= 5: briefly acknowledge the consistency streak
- If biologicalSex is "female" and cyclePhase is "ovulatory": may acknowledge training strong through a demanding hormonal phase

Style rules:
- For female athletes: acknowledge strength and resilience with warmth
- For male athletes: direct, coach-to-athlete delivery
- Never say "great work today", "keep it up", "you've got this", it's too boring and generic. Say something that shows character and personality and is a bit funny. Perhaps in a British kinda way
- Exclamation points or emojis are fine.
- Max 2 sentences. Be specific to the data provided — reference the actual lift names, weight, or block number if relevant.`;

export async function generateMotivationalMessage(
  ctx: MotivationalContext,
  sessionIds?: string[],
  userId?: string
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const result = await generateText({
    model: JIT_MODEL,
    system: SYSTEM_PROMPT,
    prompt: JSON.stringify(ctx),
    abortSignal: controller.signal,
  });
  clearTimeout(timer);
  const message = result.text.trim();

  // Fire-and-forget: persist the log for dashboard telemetry
  if (userId && sessionIds?.length) {
    typedSupabase
      .from('motivational_message_logs')
      .insert({
        user_id: userId,
        session_ids: sessionIds,
        context: JSON.parse(JSON.stringify(ctx)) as Json,
        message,
      })
      .then(({ error }) => {
        if (error) console.warn('Failed to persist motivational log:', error);
      });
  }

  return message;
}

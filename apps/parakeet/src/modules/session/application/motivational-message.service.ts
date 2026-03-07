import { generateText } from 'ai';
import { JIT_MODEL } from '@parakeet/training-engine';
import { typedSupabase } from '@platform/supabase';
import { getProfile } from '@modules/profile';

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
  cyclePhase: string | null,
): Promise<MotivationalContext> {
  const sessionIds = sessions.map((s) => s.id);

  const [logsResult, prsResult, profile] = await Promise.all([
    typedSupabase
      .from('session_logs')
      .select('session_rpe, performance_vs_plan')
      .in('session_id', sessionIds),
    typedSupabase
      .from('personal_records')
      .select('lift, pr_type')
      .in('session_id', sessionIds),
    getProfile(),
  ]);

  // Take the highest RPE across all sessions logged today
  const sessionRpe = (logsResult.data ?? []).reduce<number | null>((max, row) => {
    const rpe = row.session_rpe as number | null;
    if (rpe == null) return max;
    return max == null ? rpe : Math.max(max, rpe);
  }, null);

  const performanceVsPlan =
    ((logsResult.data?.[0]?.performance_vs_plan) as
      | 'under'
      | 'at'
      | 'over'
      | 'incomplete'
      | null) ?? null;

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
  };
}

const SYSTEM_PROMPT = `You are a concise, encouraging powerlifting coach writing a post-workout message for an athlete. Keep it to 1-2 sentences. Use specific, athletic language — not generic gym-speak.

Priority rules (apply the highest matching rule first):
1. If newPRs is non-empty: lead with praise for the personal record, naming the lift and PR type (e.g. "new estimated 1RM")
2. If sessionRpe >= 9: acknowledge the grit and mental fortitude required to push that hard
3. If performanceVsPlan is "over": note the overdelivery, keep the athlete grounded but proud
4. If performanceVsPlan is "under": gently reinforce that consistency across sessions beats any single heroic effort
5. If isDeload is true: praise the discipline and intelligence of intentionally backing off

Secondary context (weave in if space allows):
- If currentStreak >= 5: briefly acknowledge the consistency streak
- If biologicalSex is "female" and cyclePhase is "ovulatory": may acknowledge training strong through a demanding hormonal phase

Style rules:
- For female athletes: acknowledge strength and resilience with warmth
- For male athletes: direct, coach-to-athlete delivery
- Never say "great work today", "keep it up", "you've got this"
- Never use exclamation points or emojis
- Max 2 sentences. Be specific to the data provided — reference the actual lift names or block number if relevant.`;

export async function generateMotivationalMessage(
  ctx: MotivationalContext,
): Promise<string> {
  const result = await generateText({
    model: JIT_MODEL,
    system: SYSTEM_PROMPT,
    prompt: JSON.stringify(ctx),
    abortSignal: AbortSignal.timeout(8000),
  });
  return result.text.trim();
}

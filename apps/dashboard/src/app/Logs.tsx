import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { strategyBadge } from '../components/Badge';

interface TimelineEvent {
  id: string;
  ts: string;
  type: 'jit' | 'hybrid' | 'cycle_review' | 'formula_suggestion' | 'developer_suggestion';
  label: string;
  sub: string;
  meta?: Record<string, unknown>;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const typeConfig = {
  jit: {
    color: 'var(--accent)',
    bg: 'var(--accent-dim)',
    label: 'JIT',
    icon: '⚡',
  },
  hybrid: {
    color: 'var(--purple)',
    bg: 'var(--purple-dim)',
    label: 'HYBRID',
    icon: '⚖',
  },
  cycle_review: {
    color: 'var(--green)',
    bg: 'var(--green-dim)',
    label: 'CYCLE',
    icon: '◎',
  },
  formula_suggestion: {
    color: 'var(--blue)',
    bg: 'var(--blue-dim)',
    label: 'FORMULA',
    icon: '∫',
  },
  developer_suggestion: {
    color: 'var(--red)',
    bg: 'var(--red-dim)',
    label: 'DEV',
    icon: '◈',
  },
};

interface Stats {
  jit: number;
  hybrid: number;
  cycleReviews: number;
  formulaSuggestions: number;
  devSuggestions: number;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 100,
      padding: '12px 16px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

export function Logs() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [stats, setStats] = useState<Stats>({ jit: 0, hybrid: 0, cycleReviews: 0, formulaSuggestions: 0, devSuggestions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [jitRes, hybridRes, reviewRes, formulaRes, devRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, jit_generated_at, jit_strategy, scheduled_date, week_number, block_number')
          .not('jit_generated_at', 'is', null)
          .order('jit_generated_at', { ascending: false })
          .limit(30),
        supabase
          .from('jit_comparison_logs')
          .select('id, created_at, strategy_used, divergence')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('cycle_reviews')
          .select('id, generated_at, program_id')
          .order('generated_at', { ascending: false })
          .limit(10),
        supabase
          .from('formula_configs')
          .select('id, created_at, source, is_active')
          .eq('source', 'ai_suggestion')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('developer_suggestions')
          .select('id, created_at, priority, status, description')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const all: TimelineEvent[] = [];

      (jitRes.data ?? []).forEach((s: Record<string, unknown>) => {
        all.push({
          id: `jit-${s.id}`,
          ts: (s.jit_generated_at ?? s.scheduled_date) as string,
          type: 'jit',
          label: `JIT Generated — W${s.week_number} B${s.block_number}`,
          sub: `Strategy: ${s.jit_strategy ?? 'formula'} · session/${(s.id as string).slice(0, 8)}…`,
          meta: { strategy: s.jit_strategy },
        });
      });

      (hybridRes.data ?? []).forEach((l: Record<string, unknown>) => {
        const div = l.divergence as { hasDivergence?: boolean } | null;
        all.push({
          id: `hybrid-${l.id}`,
          ts: l.created_at as string,
          type: 'hybrid',
          label: `Hybrid Comparison${div?.hasDivergence ? ' — DIVERGED' : ' — Consensus'}`,
          sub: `log/${(l.id as string).slice(0, 8)}…`,
        });
      });

      (reviewRes.data ?? []).forEach((r: Record<string, unknown>) => {
        all.push({
          id: `review-${r.id}`,
          ts: r.generated_at as string,
          type: 'cycle_review',
          label: 'Cycle Review Generated',
          sub: `program/${(r.program_id as string).slice(0, 8)}…`,
        });
      });

      (formulaRes.data ?? []).forEach((c: Record<string, unknown>) => {
        all.push({
          id: `formula-${c.id}`,
          ts: c.created_at as string,
          type: 'formula_suggestion',
          label: `Formula Suggestion${c.is_active ? ' (Active)' : ''}`,
          sub: `config/${(c.id as string).slice(0, 8)}…`,
        });
      });

      (devRes.data ?? []).forEach((s: Record<string, unknown>) => {
        all.push({
          id: `dev-${s.id}`,
          ts: s.created_at as string,
          type: 'developer_suggestion',
          label: `Dev Suggestion — ${s.priority ?? 'medium'} priority`,
          sub: (s.description as string).slice(0, 80) + ((s.description as string).length > 80 ? '…' : ''),
        });
      });

      all.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      setEvents(all);

      setStats({
        jit: jitRes.data?.length ?? 0,
        hybrid: hybridRes.data?.length ?? 0,
        cycleReviews: reviewRes.data?.length ?? 0,
        formulaSuggestions: formulaRes.data?.length ?? 0,
        devSuggestions: devRes.data?.length ?? 0,
      });

      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
          AI Interaction Timeline
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          Chronological feed of all AI events — JIT sessions, hybrid comparisons, cycle reviews, suggestions
        </p>
      </div>

      {/* Stats */}
      {!loading && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }} className="animate-fade-in">
          <StatCard label="JIT Sessions" value={stats.jit} color="var(--accent)" />
          <StatCard label="Hybrid Comparisons" value={stats.hybrid} color="var(--purple)" />
          <StatCard label="Cycle Reviews" value={stats.cycleReviews} color="var(--green)" />
          <StatCard label="Formula Suggestions" value={stats.formulaSuggestions} color="var(--blue)" />
          <StatCard label="Dev Suggestions" value={stats.devSuggestions} color="var(--red)" />
        </div>
      )}

      {loading && (
        <div style={{ color: 'var(--text-dim)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24 }}>
          <span style={{ animation: 'pulse-dot 1s ease infinite', display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          Loading timeline…
        </div>
      )}

      {!loading && events.length === 0 && (
        <div style={{ color: 'var(--text-muted)', padding: '60px 0', textAlign: 'center', fontSize: 13 }}>
          No AI interactions recorded yet. Complete a workout to generate JIT logs.
        </div>
      )}

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute',
          left: 15,
          top: 8,
          bottom: 8,
          width: 1,
          background: 'var(--border)',
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} className="animate-stagger">
          {events.map(event => {
            const cfg = typeConfig[event.type];
            return (
              <div key={event.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Dot */}
                <div style={{
                  width: 30, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 12,
                  position: 'relative', zIndex: 1,
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: cfg.color,
                    boxShadow: `0 0 8px ${cfg.color}60`,
                    border: `2px solid var(--bg)`,
                  }} />
                </div>

                {/* Card */}
                <div style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  marginBottom: 2,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: cfg.color, background: cfg.bg, padding: '2px 6px', borderRadius: 3,
                    }}>
                      {cfg.label}
                    </span>
                    {event.type === 'jit' && event.meta?.strategy && strategyBadge(event.meta.strategy as string)}
                    <span style={{ color: 'var(--text-bright)', fontWeight: 600, fontSize: 12 }}>{event.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{event.sub}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 'auto' }}>{fmt(event.ts)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

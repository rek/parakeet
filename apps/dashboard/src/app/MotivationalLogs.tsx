import { useEffect, useState } from 'react';
import { Badge } from '../components/Badge';
import { JsonViewer } from '../components/JsonViewer';
import { useSupabase } from '../lib/SupabaseContext';
import { theme } from '../lib/theme';

interface MotivationalLog {
  id: string;
  user_id: string;
  session_ids: string[];
  context: Record<string, unknown>;
  message: string;
  created_at: string;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function contextBadges(ctx: Record<string, unknown>) {
  const badges: Array<{ label: string; variant: 'accent' | 'green' | 'red' | 'purple' | 'blue' | 'muted' }> = [];
  const prs = ctx.newPRs as Array<{ lift: string; prType: string }> | undefined;
  if (prs && prs.length > 0) {
    for (const pr of prs) {
      badges.push({ label: `${pr.lift} ${pr.prType}`, variant: 'purple' });
    }
  }
  const rpe = ctx.sessionRpe as number | null;
  if (rpe != null) {
    badges.push({
      label: `RPE ${rpe}`,
      variant: rpe >= 9 ? 'red' : rpe >= 8 ? 'accent' : 'green',
    });
  }
  const perf = ctx.performanceVsPlan as string | null;
  if (perf) {
    badges.push({
      label: perf,
      variant: perf === 'over' ? 'green' : perf === 'at' ? 'blue' : 'accent',
    });
  }
  if (ctx.isDeload) badges.push({ label: 'Deload', variant: 'muted' });
  const streak = ctx.currentStreak as number | undefined;
  if (streak && streak >= 5) badges.push({ label: `${streak}w streak`, variant: 'green' });
  if (ctx.biologicalSex) badges.push({ label: ctx.biologicalSex as string, variant: 'muted' });
  if (ctx.cyclePhase) badges.push({ label: ctx.cyclePhase as string, variant: 'blue' });
  return badges;
}

function LogCard({ log }: { log: MotivationalLog }) {
  const [expanded, setExpanded] = useState(false);
  const ctx = log.context;
  const lifts = (ctx.primaryLifts as string[] | undefined) ?? [];
  const badges = contextBadges(ctx);

  return (
    <div
      style={{
        background: theme.bg.surface,
        border: `1px solid ${theme.border.base}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        className="btn-reset"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '12px 14px',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: theme.font.mono,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Timestamp + lifts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: theme.color.textMuted }}>
              {fmt(log.created_at)}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: theme.color.textBright }}>
              {lifts.map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')}
            </span>
          </div>

          {/* LLM output */}
          <div
            style={{
              fontSize: 13,
              color: 'var(--accent)',
              lineHeight: 1.5,
              marginBottom: 8,
            }}
          >
            {log.message}
          </div>

          {/* Context badges */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {badges.map((b, i) => (
              <Badge key={i} label={b.label} variant={b.variant} />
            ))}
          </div>
        </div>

        <span
          style={{
            fontSize: 10,
            color: theme.color.textMuted,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {/* Expanded: full context JSON */}
      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${theme.border.base}`,
            padding: '10px 14px',
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: theme.color.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}
          >
            Full Context (LLM Input)
          </div>
          <JsonViewer data={ctx} />
          <div
            style={{
              fontSize: 9,
              color: theme.color.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: 10,
              marginBottom: 4,
            }}
          >
            Session IDs
          </div>
          <div style={{ fontSize: 11, color: theme.color.textDim, fontFamily: theme.font.mono }}>
            {log.session_ids.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}

export function MotivationalLogs() {
  const { supabase, env } = useSupabase();
  const [logs, setLogs] = useState<MotivationalLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    supabase
      .from('motivational_message_logs')
      .select('id, user_id, session_ids, context, message, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('MotivationalLogs fetch error:', error);
          setLogs([]);
        } else {
          setLogs((data ?? []) as MotivationalLog[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, env]);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 16, color: 'var(--accent)' }}>&#9679;</span>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: theme.color.textBright,
              fontFamily: theme.font.mono,
              margin: 0,
            }}
          >
            Motivational Messages
          </h2>
          <span
            style={{
              fontSize: 11,
              color: theme.color.textMuted,
              fontFamily: theme.font.mono,
            }}
          >
            Last {logs.length} messages
          </span>
        </div>
        <div style={{ fontSize: 11, color: theme.color.textDim, fontFamily: theme.font.mono }}>
          LLM input context + generated message for each completed workout
        </div>
      </div>

      {loading ? (
        <div style={{ color: theme.color.textMuted, fontFamily: theme.font.mono, fontSize: 12 }}>
          Loading...
        </div>
      ) : logs.length === 0 ? (
        <div style={{ color: theme.color.textMuted, fontFamily: theme.font.mono, fontSize: 12 }}>
          No motivational message logs found. Complete a workout to generate one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map((log) => (
            <LogCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

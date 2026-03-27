import { useEffect, useState } from 'react';

import { Badge } from '../components/Badge';
import { JsonViewer } from '../components/JsonViewer';
import { useSupabase } from '../lib/SupabaseContext';
import { theme } from '../lib/theme';

interface DecisionReplayLog {
  id: string;
  user_id: string;
  session_id: string;
  created_at: string;
  prescription_score: number;
  rpe_accuracy: number;
  volume_appropriateness: string;
  insights: string[];
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

function scoreColor(score: number) {
  if (score >= 80) return theme.color.green;
  if (score >= 60) return theme.color.accent;
  return theme.color.red;
}

function volumeBadgeVariant(v: string): 'green' | 'red' | 'accent' | 'muted' {
  if (v === 'right') return 'green';
  if (v === 'too_much') return 'red';
  if (v === 'too_little') return 'accent';
  return 'muted';
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: theme.bg.surfaceRaised,
        border: `1px solid ${theme.border.base}`,
        borderRadius: 6,
        padding: '10px 16px',
        minWidth: 120,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: theme.color.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontFamily: theme.font.mono,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: theme.font.mono,
          color: color ?? theme.color.textBright,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LogCard({ log }: { log: DecisionReplayLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: theme.bg.surface,
        border: `1px solid ${theme.border.base}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Header row — clickable to expand */}
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
          {/* Timestamp + scores */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 10, color: theme.color.textMuted }}>
              {fmt(log.created_at)}
            </span>

            {/* Prescription score */}
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: scoreColor(log.prescription_score),
              }}
            >
              Rx {log.prescription_score}
            </span>

            {/* RPE accuracy */}
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: scoreColor(log.rpe_accuracy),
              }}
            >
              RPE {log.rpe_accuracy}
            </span>

            {/* Volume appropriateness badge */}
            <Badge
              label={log.volume_appropriateness.replace(/_/g, ' ')}
              variant={volumeBadgeVariant(log.volume_appropriateness)}
            />
          </div>

          {/* Insights as bullet points */}
          {log.insights && log.insights.length > 0 && (
            <ul
              style={{
                margin: 0,
                paddingLeft: 16,
                listStyle: 'disc',
              }}
            >
              {log.insights.map((insight, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 12,
                    color: theme.color.textDim,
                    lineHeight: 1.6,
                    fontFamily: theme.font.mono,
                  }}
                >
                  {insight}
                </li>
              ))}
            </ul>
          )}
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

      {/* Expanded: session_id */}
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
            Session ID
          </div>
          <div
            style={{
              fontSize: 11,
              color: theme.color.textDim,
              fontFamily: theme.font.mono,
              marginBottom: 12,
            }}
          >
            {log.session_id}
          </div>
          <div
            style={{
              fontSize: 9,
              color: theme.color.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}
          >
            Full Record
          </div>
          <JsonViewer data={log} defaultCollapsed={false} />
        </div>
      )}
    </div>
  );
}

export function DecisionReplay() {
  const { supabase, env } = useSupabase();
  const [logs, setLogs] = useState<DecisionReplayLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    supabase
      .from('decision_replay_logs')
      .select(
        'id, user_id, session_id, created_at, prescription_score, rpe_accuracy, volume_appropriateness, insights'
      )
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('DecisionReplay fetch error:', error);
          setLogs([]);
        } else {
          setLogs((data ?? []) as DecisionReplayLog[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, env]);

  // Derived summary stats
  const avgPrescription =
    logs.length > 0
      ? avg(logs.map((l) => l.prescription_score)).toFixed(1)
      : '—';
  const avgRpe =
    logs.length > 0 ? avg(logs.map((l) => l.rpe_accuracy)).toFixed(1) : '—';
  const tooMuch = logs.filter(
    (l) => l.volume_appropriateness === 'too_much'
  ).length;
  const right = logs.filter((l) => l.volume_appropriateness === 'right').length;
  const tooLittle = logs.filter(
    (l) => l.volume_appropriateness === 'too_little'
  ).length;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
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
            Decision Replay
          </h2>
          <span
            style={{
              fontSize: 11,
              color: theme.color.textMuted,
              fontFamily: theme.font.mono,
            }}
          >
            {logs.length} records
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: theme.color.textDim,
            fontFamily: theme.font.mono,
          }}
        >
          Retrospective prescription accuracy scoring
        </div>
      </div>

      {loading ? (
        <div
          style={{
            color: theme.color.textMuted,
            fontFamily: theme.font.mono,
            fontSize: 12,
          }}
        >
          Loading...
        </div>
      ) : logs.length === 0 ? (
        <div
          style={{
            color: theme.color.textMuted,
            fontFamily: theme.font.mono,
            fontSize: 12,
          }}
        >
          No decision replay logs found. Complete sessions with LLM challenge
          mode enabled to generate records.
        </div>
      ) : (
        <>
          {/* Summary stats bar */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 20,
            }}
          >
            <StatBox
              label="Avg Prescription Score"
              value={String(avgPrescription)}
              color={
                typeof avgPrescription === 'string' && avgPrescription !== '—'
                  ? scoreColor(parseFloat(avgPrescription))
                  : theme.color.textBright
              }
            />
            <StatBox
              label="Avg RPE Accuracy"
              value={String(avgRpe)}
              color={
                typeof avgRpe === 'string' && avgRpe !== '—'
                  ? scoreColor(parseFloat(avgRpe))
                  : theme.color.textBright
              }
            />
            <StatBox
              label="Volume: Right"
              value={String(right)}
              color={theme.color.green}
            />
            <StatBox
              label="Volume: Too Much"
              value={String(tooMuch)}
              color={theme.color.red}
            />
            <StatBox
              label="Volume: Too Little"
              value={String(tooLittle)}
              color={theme.color.accent}
            />
          </div>

          {/* Log cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logs.map((log) => (
              <LogCard key={log.id} log={log} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';

import { Badge } from '../components/Badge';
import { useSupabase } from '../lib/SupabaseContext';
import { theme } from '../lib/theme';

interface WorkoutRow {
  id: string;
  planned_date: string | null;
  completed_at: string | null;
  primary_lift: string | null;
  intensity_type: string | null;
  activity_name: string | null;
  week_number: number;
  block_number: number | null;
  is_deload: boolean;
  user_id: string;
  session_logs: Array<{
    session_rpe: number | null;
    performance_vs_plan: string | null;
    completion_pct: number | null;
  }>;
  personal_records: Array<{
    lift: string;
    pr_type: string;
  }>;
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function liftLabel(row: WorkoutRow): string {
  if (row.primary_lift) return titleCase(row.primary_lift);
  if (row.activity_name) return row.activity_name;
  return '—';
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function rpeBadge(rpe: number | null) {
  if (rpe == null) return <Badge label="No RPE" variant="muted" />;
  if (rpe >= 9) return <Badge label={`RPE ${rpe}`} variant="red" />;
  if (rpe >= 8) return <Badge label={`RPE ${rpe}`} variant="accent" />;
  return <Badge label={`RPE ${rpe}`} variant="green" />;
}

function perfBadge(perf: string | null) {
  if (perf === 'over') return <Badge label="Over" variant="green" />;
  if (perf === 'at') return <Badge label="At Plan" variant="blue" />;
  if (perf === 'under') return <Badge label="Under" variant="accent" />;
  if (perf === 'incomplete') return <Badge label="Incomplete" variant="red" />;
  return <Badge label="—" variant="muted" />;
}

function prTypeName(prType: string): string {
  if (prType === 'estimated_1rm') return '1RM';
  if (prType === 'volume') return 'Volume';
  if (prType === 'rep_at_weight') return 'Rep PR';
  return prType;
}

function CompletionBar({ pct }: { pct: number | null }) {
  const value = pct ?? 0;
  const color =
    value >= 90
      ? theme.color.green
      : value >= 70
        ? theme.color.accent
        : theme.color.red;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}
    >
      <div
        style={{
          flex: 1,
          height: 4,
          background: theme.bg.surfaceOverlay,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, value)}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
            transition: 'width 0.3s',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 10,
          color: theme.color.textDim,
          fontFamily: theme.font.mono,
        }}
      >
        {Math.round(value)}%
      </span>
    </div>
  );
}

function WorkoutRow({ row }: { row: WorkoutRow }) {
  const log = row.session_logs[0];
  const prs = row.personal_records;
  const lift = liftLabel(row);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 100px 80px 1fr 100px 100px auto',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderBottom: `1px solid ${theme.border.base}`,
        fontSize: 12,
        fontFamily: theme.font.mono,
        color: theme.color.text,
      }}
    >
      {/* Date */}
      <span style={{ color: theme.color.textDim }}>
        {row.completed_at ? fmt(row.completed_at) : '—'}
      </span>

      {/* Lift + intensity */}
      <div>
        <span style={{ fontWeight: 600 }}>{lift}</span>
        <span
          style={{ color: theme.color.textMuted, marginLeft: 4, fontSize: 10 }}
        >
          {row.intensity_type ?? ''}
        </span>
      </div>

      {/* Week/Block */}
      <span style={{ color: theme.color.textDim }}>
        W{row.week_number}
        {row.block_number != null ? `/B${row.block_number}` : ''}
        {row.is_deload ? ' (D)' : ''}
      </span>

      {/* PRs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {prs.map((pr, i) => (
          <Badge
            key={i}
            label={`${pr.lift.charAt(0).toUpperCase() + pr.lift.slice(1)} ${prTypeName(pr.pr_type)}`}
            variant="purple"
          />
        ))}
      </div>

      {/* Completion */}
      <CompletionBar pct={log?.completion_pct ?? null} />

      {/* RPE */}
      {rpeBadge(log?.session_rpe ?? null)}

      {/* Performance */}
      {perfBadge(log?.performance_vs_plan ?? null)}
    </div>
  );
}

export function WorkoutSummaries() {
  const { supabase, env } = useSupabase();
  const [rows, setRows] = useState<WorkoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    supabase
      .from('sessions')
      .select(
        `id, user_id, planned_date, completed_at, primary_lift,
         intensity_type, activity_name, week_number, block_number, is_deload,
         session_logs(session_rpe, performance_vs_plan, completion_pct),
         personal_records(lift, pr_type)`
      )
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('WorkoutSummaries fetch error:', error);
          setRows([]);
        } else {
          setRows(
            (data ?? []).map((row) => ({
              ...row,
              session_logs: Array.isArray(row.session_logs)
                ? row.session_logs
                : row.session_logs
                  ? [row.session_logs]
                  : [],
              personal_records: Array.isArray(row.personal_records)
                ? row.personal_records
                : row.personal_records
                  ? [row.personal_records]
                  : [],
            })) as WorkoutRow[]
          );
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, env]);

  const prCount = rows.reduce((n, r) => n + r.personal_records.length, 0);
  const avgRpe =
    rows.reduce((sum, r) => {
      const rpe = r.session_logs[0]?.session_rpe;
      return rpe != null ? sum + rpe : sum;
    }, 0) /
    (rows.filter((r) => r.session_logs[0]?.session_rpe != null).length || 1);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 16, color: theme.color.green }}>
            &#9679;
          </span>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: theme.color.textBright,
              fontFamily: theme.font.mono,
              margin: 0,
            }}
          >
            Workout Summaries
          </h2>
          <span
            style={{
              fontSize: 11,
              color: theme.color.textMuted,
              fontFamily: theme.font.mono,
            }}
          >
            Last {rows.length} sessions
          </span>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            fontSize: 11,
            fontFamily: theme.font.mono,
          }}
        >
          <div>
            <span style={{ color: theme.color.textMuted }}>Total PRs: </span>
            <span style={{ color: theme.color.purple, fontWeight: 600 }}>
              {prCount}
            </span>
          </div>
          <div>
            <span style={{ color: theme.color.textMuted }}>Avg RPE: </span>
            <span style={{ color: theme.color.accent, fontWeight: 600 }}>
              {avgRpe ? avgRpe.toFixed(1) : '—'}
            </span>
          </div>
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
      ) : rows.length === 0 ? (
        <div
          style={{
            color: theme.color.textMuted,
            fontFamily: theme.font.mono,
            fontSize: 12,
          }}
        >
          No completed sessions found.
        </div>
      ) : (
        <div
          style={{
            background: theme.bg.surface,
            border: `1px solid ${theme.border.base}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '140px 100px 80px 1fr 100px 100px auto',
              gap: 10,
              padding: '8px 14px',
              borderBottom: `1px solid ${theme.border.base}`,
              fontSize: 10,
              fontFamily: theme.font.mono,
              color: theme.color.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            <span>Date</span>
            <span>Lift</span>
            <span>Week</span>
            <span>PRs</span>
            <span>Completion</span>
            <span>RPE</span>
            <span>vs Plan</span>
          </div>
          {rows.map((row) => (
            <WorkoutRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

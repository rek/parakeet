import { Badge } from '../components/Badge';
import { TablePage } from '../components/TablePage';
import { useSupabaseRows } from '../lib/useSupabaseRows';
import { theme } from '../lib/theme';

interface CheckinRow {
  id: string;
  recorded_at: string;
  user_id: string;
  session_id: string | null;
  skipped: boolean;
  ratings: Record<string, number> | null;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sorenessVariant(score: number) {
  if (score >= 4) return 'red' as const;
  if (score >= 3) return 'accent' as const;
  if (score >= 1) return 'blue' as const;
  return 'muted' as const;
}

function topSoreMuscles(ratings: Record<string, number> | null): {
  muscle: string;
  score: number;
}[] {
  if (!ratings) return [];
  return Object.entries(ratings)
    .map(([muscle, score]) => ({ muscle, score }))
    .filter((r) => typeof r.score === 'number' && r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function SorenessCheckins() {
  const { rows, loading, error } = useSupabaseRows<CheckinRow>((s) =>
    s
      .from('soreness_checkins')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(80)
  );

  const skipped = rows.filter((r) => r.skipped).length;
  const submitted = rows.filter((r) => !r.skipped).length;
  const avgMaxScore =
    submitted > 0
      ? rows
          .filter((r) => !r.skipped && r.ratings)
          .map((r) => Math.max(0, ...Object.values(r.ratings ?? {})))
          .reduce((n, v) => n + v, 0) / submitted
      : null;

  return (
    <TablePage
      title="Soreness Check-ins"
      accent={theme.color.accent}
      subtitle={`Last ${rows.length} entries`}
      stats={[
        { label: 'Submitted', value: submitted, color: theme.color.green },
        { label: 'Skipped', value: skipped, color: theme.color.textMuted },
        {
          label: 'Avg peak',
          value: avgMaxScore != null ? avgMaxScore.toFixed(1) : '—',
          color: theme.color.accent,
        },
      ]}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No soreness check-ins recorded yet."
      columnsTemplate="130px 1fr 80px 1fr"
      columnLabels={['Recorded', 'User', 'Status', 'Top sore muscles']}
      keyOf={(r) => r.id}
      renderRow={(r) => {
        const top = topSoreMuscles(r.ratings);
        return (
          <>
            <span style={{ color: theme.color.textDim }}>{fmt(r.recorded_at)}</span>
            <span
              style={{
                color: theme.color.textDim,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={r.user_id}
            >
              {r.user_id.slice(0, 8)}
            </span>
            {r.skipped ? (
              <Badge label="Skipped" variant="muted" />
            ) : (
              <Badge label="Done" variant="green" />
            )}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {top.length === 0 && !r.skipped && (
                <span style={{ color: theme.color.textMuted, fontSize: 11 }}>
                  No soreness reported
                </span>
              )}
              {top.map((m) => (
                <Badge
                  key={m.muscle}
                  label={`${m.muscle} ${m.score}`}
                  variant={sorenessVariant(m.score)}
                />
              ))}
            </div>
          </>
        );
      }}
    />
  );
}

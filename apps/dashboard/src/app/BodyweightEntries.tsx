import { TablePage } from '../components/TablePage';
import { theme } from '../lib/theme';
import { useSupabaseRows } from '../lib/useSupabaseRows';

interface BwRow {
  id: string;
  recorded_date: string;
  user_id: string;
  weight_kg: number;
  created_at: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function deltaColor(showDelta: boolean, delta: number | undefined) {
  if (!showDelta || delta == null) return theme.color.textMuted;
  if (delta > 0) return theme.color.accent;
  if (delta < 0) return theme.color.green;
  return theme.color.textDim;
}

export function BodyweightEntries() {
  const { rows, loading, error } = useSupabaseRows<BwRow>((s) =>
    s
      .from('bodyweight_entries')
      .select('*')
      .order('recorded_date', { ascending: false })
      .limit(120)
  );

  const uniqueUsers = new Set(rows.map((r) => r.user_id)).size;
  const avgKg =
    rows.length > 0
      ? rows.reduce((n, r) => n + r.weight_kg, 0) / rows.length
      : null;

  // Compute trend per user (most recent vs previous entry by date)
  const trendsByUser = new Map<string, number>();
  const sortedByUser = new Map<string, BwRow[]>();
  for (const r of rows) {
    const arr = sortedByUser.get(r.user_id) ?? [];
    arr.push(r);
    sortedByUser.set(r.user_id, arr);
  }
  for (const [userId, list] of sortedByUser.entries()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) =>
      a.recorded_date < b.recorded_date ? 1 : -1
    );
    const delta = sorted[0].weight_kg - sorted[1].weight_kg;
    trendsByUser.set(userId, delta);
  }

  return (
    <TablePage
      title="Bodyweight Entries"
      accent={theme.color.green}
      subtitle={`Last ${rows.length} entries`}
      stats={[
        { label: 'Lifters', value: uniqueUsers, color: theme.color.blue },
        {
          label: 'Avg weight',
          value: avgKg != null ? `${avgKg.toFixed(1)}kg` : '—',
          color: theme.color.green,
        },
      ]}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No bodyweight entries recorded yet."
      columnsTemplate="120px 1fr 80px 80px"
      columnLabels={['Recorded', 'User', 'Weight', 'Δ from last']}
      keyOf={(r) => r.id}
      renderRow={(r) => {
        const delta = trendsByUser.get(r.user_id);
        const showDelta =
          delta != null &&
          rows.find(
            (x) => x.user_id === r.user_id && x.weight_kg === r.weight_kg
          ) === r;
        return (
          <>
            <span style={{ color: theme.color.textDim }}>
              {fmtDate(r.recorded_date)}
            </span>
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
            <span style={{ fontWeight: 600 }}>{r.weight_kg.toFixed(1)}kg</span>
            <span
              style={{
                color: deltaColor(showDelta, delta),
              }}
            >
              {showDelta && delta != null
                ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}kg`
                : '—'}
            </span>
          </>
        );
      }}
    />
  );
}

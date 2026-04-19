import { Badge } from '../components/Badge';
import { TablePage } from '../components/TablePage';
import { useSupabaseRows } from '../lib/useSupabaseRows';
import { theme } from '../lib/theme';

interface BadgeRow {
  id: string;
  earned_at: string;
  user_id: string;
  badge_id: string;
  session_id: string | null;
  metadata: Record<string, unknown> | null;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function badgeIdLabel(id: string) {
  // human-friendly: snake_case → Title Case
  return id
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function metadataPreview(m: Record<string, unknown> | null): string {
  if (!m) return '—';
  const entries = Object.entries(m).slice(0, 3);
  if (entries.length === 0) return '—';
  return entries
    .map(([k, v]) => `${k}=${typeof v === 'object' ? '…' : String(v)}`)
    .join(' · ');
}

export function UserBadges() {
  const { rows, loading, error } = useSupabaseRows<BadgeRow>((s) =>
    s
      .from('user_badges')
      .select('*')
      .order('earned_at', { ascending: false })
      .limit(120)
  );

  const uniqueBadges = new Set(rows.map((r) => r.badge_id));
  const uniqueUsers = new Set(rows.map((r) => r.user_id));
  const tied = rows.filter((r) => r.session_id != null).length;

  return (
    <TablePage
      title="User Badges"
      accent={theme.color.purple}
      subtitle={`Last ${rows.length} earnings`}
      stats={[
        { label: 'Distinct badges', value: uniqueBadges.size, color: theme.color.purple },
        { label: 'Lifters', value: uniqueUsers.size, color: theme.color.blue },
        {
          label: 'Tied to a session',
          value: tied,
          color: theme.color.green,
        },
      ]}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No badges earned yet."
      columnsTemplate="120px 1fr 200px 1fr"
      columnLabels={['Earned', 'User', 'Badge', 'Metadata']}
      keyOf={(r) => r.id}
      renderRow={(r) => (
        <>
          <span style={{ color: theme.color.textDim }}>{fmt(r.earned_at)}</span>
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
          <Badge label={badgeIdLabel(r.badge_id)} variant="purple" />
          <span
            style={{
              color: theme.color.textMuted,
              fontSize: 11,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={metadataPreview(r.metadata)}
          >
            {metadataPreview(r.metadata)}
          </span>
        </>
      )}
    />
  );
}

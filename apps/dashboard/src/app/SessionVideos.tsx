import { Badge } from '../components/Badge';
import { TablePage } from '../components/TablePage';
import { useSupabaseRows } from '../lib/useSupabaseRows';
import { theme } from '../lib/theme';

interface VideoRow {
  id: string;
  created_at: string;
  user_id: string;
  session_id: string;
  lift: string;
  set_number: number;
  duration_sec: number;
  sagittal_confidence: number;
  set_weight_grams: number | null;
  set_reps: number | null;
  set_rpe: number | null;
  analysis: unknown;
  coaching_response: unknown;
  debug_landmarks: unknown;
  remote_uri: string | null;
  recorded_by: string | null;
  video_width_px: number | null;
  video_height_px: number | null;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function confidenceVariant(c: number) {
  if (c >= 0.8) return 'green' as const;
  if (c >= 0.5) return 'accent' as const;
  return 'red' as const;
}

export function SessionVideos() {
  const { rows, loading, error } = useSupabaseRows<VideoRow>((s) =>
    s
      .from('session_videos')
      .select(
        'id, created_at, user_id, session_id, lift, set_number, duration_sec, sagittal_confidence, set_weight_grams, set_reps, set_rpe, analysis, coaching_response, debug_landmarks, remote_uri, recorded_by, video_width_px, video_height_px'
      )
      .order('created_at', { ascending: false })
      .limit(80)
  );

  const analysed = rows.filter((r) => r.analysis != null).length;
  const coached = rows.filter((r) => r.coaching_response != null).length;
  const withLandmarks = rows.filter((r) => r.debug_landmarks != null).length;
  const partner = rows.filter((r) => r.recorded_by != null).length;

  return (
    <TablePage
      title="Session Videos"
      accent={theme.color.purple}
      subtitle={`Last ${rows.length} videos`}
      stats={[
        { label: 'Analysed', value: analysed, color: theme.color.green },
        { label: 'Coached', value: coached, color: theme.color.blue },
        {
          label: 'With landmarks',
          value: withLandmarks,
          color: theme.color.accent,
        },
        { label: 'Partner-filmed', value: partner, color: theme.color.purple },
      ]}
      loading={loading}
      error={error}
      rows={rows}
      emptyMessage="No session videos found."
      columnsTemplate="120px 80px 80px 90px 90px 1fr 60px"
      columnLabels={[
        'Recorded',
        'Lift',
        'Set',
        'Weight',
        'Reps · RPE',
        'Pipeline',
        'Conf',
      ]}
      keyOf={(r) => r.id}
      renderRow={(r) => (
        <>
          <span style={{ color: theme.color.textDim }}>{fmt(r.created_at)}</span>
          <span style={{ fontWeight: 600 }}>
            {r.lift.charAt(0).toUpperCase() + r.lift.slice(1)}
          </span>
          <span style={{ color: theme.color.textDim }}>#{r.set_number}</span>
          <span>
            {r.set_weight_grams != null
              ? `${(r.set_weight_grams / 1000).toFixed(1)}kg`
              : '—'}
          </span>
          <span style={{ color: theme.color.textDim }}>
            {r.set_reps ?? '—'} · {r.set_rpe ?? '—'}
          </span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {r.analysis != null && <Badge label="Analysis" variant="green" />}
            {r.coaching_response != null && (
              <Badge label="Coaching" variant="blue" />
            )}
            {r.debug_landmarks != null && (
              <Badge label="Landmarks" variant="accent" />
            )}
            {r.remote_uri != null && (
              <Badge label="Cloud" variant="purple" />
            )}
            {r.recorded_by != null && (
              <Badge label="Partner" variant="purple" />
            )}
            {r.analysis == null && r.coaching_response == null && (
              <Badge label="Raw" variant="muted" />
            )}
          </div>
          <Badge
            label={r.sagittal_confidence.toFixed(2)}
            variant={confidenceVariant(r.sagittal_confidence)}
          />
        </>
      )}
    />
  );
}

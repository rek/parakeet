import { useEffect, useState } from 'react';

import { Badge } from '../components/Badge';
import { JsonViewer } from '../components/JsonViewer';
import { useSupabase } from '../lib/SupabaseContext';
import { theme } from '../lib/theme';

interface ChallengeReview {
  id: string;
  user_id: string;
  session_id: string;
  created_at: string;
  score: number;
  verdict: string;
  concerns: string[];
  suggested_overrides: Record<string, unknown> | null;
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

function verdictBadge(verdict: string) {
  if (verdict === 'accept') return <Badge label="accept" variant="green" />;
  if (verdict === 'flag') return <Badge label="flag" variant="accent" />;
  return <Badge label={verdict} variant="muted" />;
}

function LogCard({ review }: { review: ChallengeReview }) {
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
      {/* Header row — always visible */}
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
          {/* Timestamp + score + verdict */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 10, color: theme.color.textMuted }}>
              {fmt(review.created_at)}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: scoreColor(review.score),
                fontFamily: theme.font.mono,
              }}
            >
              {review.score}
            </span>
            {verdictBadge(review.verdict)}
          </div>

          {/* Concerns */}
          {review.concerns.length > 0 && (
            <ul
              style={{
                margin: '0 0 0 12px',
                padding: 0,
                listStyle: 'disc',
              }}
            >
              {review.concerns.map((concern, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 12,
                    color: theme.color.text,
                    lineHeight: 1.6,
                    fontFamily: theme.font.mono,
                  }}
                >
                  {concern}
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

      {/* Expanded: suggested_overrides JSON */}
      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${theme.border.base}`,
            padding: '10px 14px',
          }}
        >
          {review.suggested_overrides && (
            <>
              <div
                style={{
                  fontSize: 9,
                  color: theme.color.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 6,
                }}
              >
                Suggested Overrides
              </div>
              <JsonViewer
                data={review.suggested_overrides}
                defaultCollapsed={false}
              />
            </>
          )}
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
            Session ID
          </div>
          <div
            style={{
              fontSize: 11,
              color: theme.color.textDim,
              fontFamily: theme.font.mono,
            }}
          >
            {review.session_id}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChallengeReviews() {
  const { supabase, env } = useSupabase();
  const [reviews, setReviews] = useState<ChallengeReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    supabase
      .from('challenge_reviews')
      .select(
        'id, user_id, session_id, created_at, score, verdict, concerns, suggested_overrides'
      )
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('ChallengeReviews fetch error:', error);
          setReviews([]);
        } else {
          setReviews((data ?? []) as ChallengeReview[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, env]);

  const avgScore =
    reviews.length > 0
      ? Math.round(
          reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length
        )
      : null;

  const flagCount = reviews.filter((r) => r.verdict === 'flag').length;
  const flagRate =
    reviews.length > 0 ? Math.round((flagCount / reviews.length) * 100) : null;

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
            Challenge Reviews
          </h2>
          <span
            style={{
              fontSize: 11,
              color: theme.color.textMuted,
              fontFamily: theme.font.mono,
            }}
          >
            Last {reviews.length} reviews
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: theme.color.textDim,
            fontFamily: theme.font.mono,
          }}
        >
          Post-hoc LLM review of formula JIT decisions
        </div>
      </div>

      {/* Summary stats bar */}
      {!loading && reviews.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 24,
            background: theme.bg.surfaceRaised,
            border: `1px solid ${theme.border.base}`,
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 16,
            fontFamily: theme.font.mono,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                color: theme.color.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 2,
              }}
            >
              Avg Score
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color:
                  avgScore != null ? scoreColor(avgScore) : theme.color.textDim,
              }}
            >
              {avgScore ?? '—'}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 9,
                color: theme.color.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 2,
              }}
            >
              Flag Rate
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color:
                  flagRate != null && flagRate > 0
                    ? theme.color.accent
                    : theme.color.green,
              }}
            >
              {flagRate != null ? `${flagRate}%` : '—'}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 9,
                color: theme.color.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 2,
              }}
            >
              Total
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: theme.color.textBright,
              }}
            >
              {reviews.length}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
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
      ) : reviews.length === 0 ? (
        <div
          style={{
            color: theme.color.textMuted,
            fontFamily: theme.font.mono,
            fontSize: 12,
          }}
        >
          No challenge reviews found. Run a session using the hybrid or LLM
          strategy to generate one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reviews.map((review) => (
            <LogCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}

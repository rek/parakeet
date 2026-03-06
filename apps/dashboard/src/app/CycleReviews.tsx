import { useEffect, useState } from 'react';
import type { DbRow } from '@platform/supabase';
import { JsonViewer } from '../components/JsonViewer';
import { useSupabase } from '../lib/SupabaseContext';
import { theme } from '../lib/theme';

type CycleReview = DbRow<'cycle_reviews'>;

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface LLMResponse {
  overallAssessment?: string;
  progressByLift?: Record<string, { rating?: string; narrative?: string }>;
  auxiliaryInsights?: {
    lift?: string;
    recommendation?: string;
    rationale?: string;
  }[];
  formulaSuggestions?: {
    parameter?: string;
    currentValue?: unknown;
    suggestedValue?: unknown;
    rationale?: string;
  }[];
  structuralSuggestions?: {
    description?: string;
    priority?: string;
    rationale?: string;
    developerNote?: string;
  }[];
  nextCycleRecommendations?: string;
  menstrualCycleInsights?: string;
}

function RatingChip({ rating }: { rating: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    excellent: { color: 'var(--green)', bg: 'var(--green-dim)' },
    good: { color: 'var(--blue)', bg: 'var(--blue-dim)' },
    moderate: { color: 'var(--accent)', bg: 'var(--accent-dim)' },
    poor: { color: 'var(--red)', bg: 'var(--red-dim)' },
  };
  const v = map[rating.toLowerCase()] ?? {
    color: 'var(--text-dim)',
    bg: theme.bg.surfaceOverlay,
  };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: v.color,
        background: v.bg,
        padding: '2px 7px',
        borderRadius: 3,
      }}
    >
      {rating}
    </span>
  );
}

function ReviewCard({ review }: { review: CycleReview }) {
  const [expanded, setExpanded] = useState(false);
  const llm = review.llm_response as LLMResponse;

  const lifts = llm.progressByLift ? Object.entries(llm.progressByLift) : [];
  const formulaSuggestions = llm.formulaSuggestions ?? [];
  const structuralSuggestions = llm.structuralSuggestions ?? [];

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        className="btn-reset"
        style={{
          padding: '14px 16px',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span
            style={{
              color: 'var(--accent)',
              fontSize: 10,
              marginTop: 3,
              flexShrink: 0,
            }}
          >
            {expanded ? '▾' : '▸'}
          </span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
                {fmt(review.generated_at)}
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '2px 6px',
                  background: 'var(--accent-dim)',
                  borderRadius: 3,
                  fontWeight: 700,
                }}
              >
                Cycle Review
              </span>
              {formulaSuggestions.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--blue)' }}>
                  {formulaSuggestions.length} formula suggestion
                  {formulaSuggestions.length !== 1 ? 's' : ''}
                </span>
              )}
              {structuralSuggestions.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--purple)' }}>
                  {structuralSuggestions.length} structural suggestion
                  {structuralSuggestions.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div
              style={{
                color: 'var(--text-dim)',
                fontSize: 11,
                marginBottom: 4,
              }}
            >
              program/{review.program_id.slice(0, 8)}…
            </div>
            {llm.overallAssessment && (
              <p
                style={{
                  color: 'var(--text)',
                  fontSize: 12,
                  lineHeight: 1.7,
                  fontStyle: 'italic',
                  opacity: 0.85,
                }}
              >
                "{llm.overallAssessment.slice(0, 180)}
                {llm.overallAssessment.length > 180 ? '…' : ''}"
              </p>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* Overall assessment */}
          {llm.overallAssessment && (
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 8,
                }}
              >
                Overall Assessment
              </div>
              <p
                style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.8 }}
              >
                {llm.overallAssessment}
              </p>
            </div>
          )}

          {/* Progress by lift */}
          {lifts.length > 0 && (
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 10,
                }}
              >
                Progress by Lift
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {lifts.map(([lift, data]) => (
                  <div
                    key={lift}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg)',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--text-bright)',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}
                      >
                        {lift}
                      </span>
                      {data.rating && <RatingChip rating={data.rating} />}
                    </div>
                    {data.narrative && (
                      <p
                        style={{
                          color: 'var(--text)',
                          fontSize: 12,
                          lineHeight: 1.7,
                        }}
                      >
                        {data.narrative}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formula suggestions */}
          {formulaSuggestions.length > 0 && (
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--blue)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 10,
                  fontWeight: 700,
                }}
              >
                Formula Suggestions ({formulaSuggestions.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {formulaSuggestions.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--blue-dim)',
                      borderRadius: 6,
                      border: `1px solid ${theme.border.blueLight}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        marginBottom: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: 'var(--blue)', fontWeight: 600 }}>
                        {s.parameter}
                      </span>
                      {s.currentValue !== undefined && (
                        <>
                          <span
                            style={{ color: 'var(--text-muted)', fontSize: 11 }}
                          >
                            {JSON.stringify(s.currentValue)}
                          </span>
                          <span
                            style={{ color: 'var(--text-dim)', fontSize: 11 }}
                          >
                            →
                          </span>
                          <span
                            style={{ color: 'var(--accent)', fontWeight: 600 }}
                          >
                            {JSON.stringify(s.suggestedValue)}
                          </span>
                        </>
                      )}
                    </div>
                    {s.rationale && (
                      <p
                        style={{
                          color: 'var(--text)',
                          fontSize: 12,
                          lineHeight: 1.6,
                        }}
                      >
                        {s.rationale}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Structural suggestions */}
          {structuralSuggestions.length > 0 && (
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--purple)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 10,
                  fontWeight: 700,
                }}
              >
                Structural Suggestions ({structuralSuggestions.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {structuralSuggestions.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--purple-dim)',
                      borderRadius: 6,
                      border: `1px solid ${theme.border.purpleLight}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: 'var(--purple)', fontWeight: 600 }}>
                        {s.description}
                      </span>
                      {s.priority && (
                        <span
                          style={{
                            fontSize: 9,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            padding: '1px 5px',
                            borderRadius: 3,
                            color:
                              s.priority === 'high'
                                ? 'var(--red)'
                                : s.priority === 'medium'
                                  ? 'var(--accent)'
                                  : 'var(--text-dim)',
                            background:
                              s.priority === 'high'
                                ? 'var(--red-dim)'
                                : s.priority === 'medium'
                                  ? 'var(--accent-dim)'
                                  : theme.bg.surfaceOverlay,
                            fontWeight: 700,
                          }}
                        >
                          {s.priority}
                        </span>
                      )}
                    </div>
                    {s.rationale && (
                      <p
                        style={{
                          color: 'var(--text)',
                          fontSize: 12,
                          lineHeight: 1.6,
                          marginBottom: 4,
                        }}
                      >
                        {s.rationale}
                      </p>
                    )}
                    {s.developerNote && (
                      <p
                        style={{
                          color: 'var(--purple)',
                          fontSize: 11,
                          lineHeight: 1.5,
                          opacity: 0.7,
                        }}
                      >
                        DEV: {s.developerNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next cycle + menstrual insights */}
          {(llm.nextCycleRecommendations || llm.menstrualCycleInsights) && (
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              {llm.nextCycleRecommendations && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 6,
                    }}
                  >
                    Next Cycle
                  </div>
                  <p
                    style={{
                      color: 'var(--text)',
                      fontSize: 12,
                      lineHeight: 1.7,
                    }}
                  >
                    {llm.nextCycleRecommendations}
                  </p>
                </div>
              )}
              {llm.menstrualCycleInsights && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--purple)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 6,
                      fontWeight: 700,
                    }}
                  >
                    Cycle Insights
                  </div>
                  <p
                    style={{
                      color: 'var(--text)',
                      fontSize: 12,
                      lineHeight: 1.7,
                    }}
                  >
                    {llm.menstrualCycleInsights}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Raw JSON */}
          <div
            style={{
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <JsonViewer
              data={review.llm_response}
              label="Full LLM Response"
              defaultCollapsed
            />
            <JsonViewer
              data={review.compiled_report}
              label="Compiled Report (Input)"
              defaultCollapsed
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function CycleReviews() {
  const { supabase } = useSupabase();
  const [reviews, setReviews] = useState<CycleReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('cycle_reviews')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(50);

      if (error) setError(error.message);
      else setReviews((data ?? []) as CycleReview[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text-bright)',
            marginBottom: 4,
          }}
        >
          Cycle Reviews
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          End-of-cycle Claude Sonnet analysis — assessment, lift progress,
          formula &amp; structural suggestions
        </p>
      </div>

      {loading && (
        <div
          style={{
            color: 'var(--text-dim)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              animation: 'pulse-dot 1s ease infinite',
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent)',
            }}
          />
          Loading cycle reviews…
        </div>
      )}
      {error && (
        <div
          style={{
            color: 'var(--red)',
            padding: '8px 12px',
            background: 'var(--red-dim)',
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && reviews.length === 0 && (
        <div
          style={{
            color: 'var(--text-muted)',
            padding: '40px 0',
            textAlign: 'center',
            fontSize: 13,
          }}
        >
          No cycle reviews yet. Complete a program cycle (≥80%) to trigger
          generation.
        </div>
      )}

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        className="animate-stagger"
      >
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>
    </div>
  );
}

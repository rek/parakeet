import { useEffect, useState } from 'react';
import type { DbRow } from '@platform/supabase';
import { strategyBadge } from '../components/Badge';
import { JsonViewer } from '../components/JsonViewer';
import { supabase } from '../lib/supabase';

type Session = DbRow<'sessions'>;

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

function modifierColor(val: number) {
  if (val > 1.05) return 'var(--green)';
  if (val < 0.95) return 'var(--red)';
  return 'var(--text-bright)';
}

function ModifierBar({
  value,
  min = 0.4,
  max = 1.2,
}: {
  value: number;
  min?: number;
  max?: number;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const clampedPct = Math.max(0, Math.min(100, pct));
  const neutralPct = ((1.0 - min) / (max - min)) * 100;
  return (
    <div
      style={{
        position: 'relative',
        height: 4,
        background: 'var(--surface)',
        borderRadius: 2,
        margin: '4px 0',
      }}
    >
      {/* neutral line */}
      <div
        style={{
          position: 'absolute',
          left: `${neutralPct}%`,
          top: -2,
          bottom: -2,
          width: 1,
          background: 'var(--border-light)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: value >= 1 ? `${neutralPct}%` : `${clampedPct}%`,
          width: `${Math.abs(clampedPct - neutralPct)}%`,
          top: 0,
          bottom: 0,
          borderRadius: 2,
          background: value >= 1 ? 'var(--green)' : 'var(--red)',
          opacity: 0.7,
        }}
      />
    </div>
  );
}

interface JITOutput {
  intensityModifier?: number;
  setModifier?: number;
  skipMainLift?: boolean;
  rationale?: string[];
  restAdjustments?: Record<string, number>;
  llmRestSuggestion?: { deltaSeconds: number; rationale: string };
}

function SessionCard({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(false);
  const input = session.jit_input_snapshot as Record<string, unknown> | null;
  const output = session.planned_sets as JITOutput | null;

  const intensity = output?.intensityModifier ?? 1.0;
  const setDelta = output?.setModifier ?? 0;
  const rationale: string[] = output?.rationale ?? [];

  const possibleDate = session.jit_generated_at ?? session.planned_date;
  const topDate = possibleDate ? fmt(possibleDate) : 'No JIT generated';

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = 'var(--border-light)')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = 'var(--border)')
      }
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ color: 'var(--accent)', fontSize: 10 }}>
          {expanded ? '▾' : '▸'}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
              {topDate}
            </span>
            {strategyBadge(session.jit_strategy ?? 'formula')}
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              W{session.week_number} B{session.block_number}
            </span>
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2 }}>
            session/{session.id.slice(0, 8)}…
          </div>
        </div>

        {/* Quick stats */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Intensity
            </div>
            <div
              style={{
                color: modifierColor(intensity),
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {(intensity * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Sets Δ
            </div>
            <div
              style={{
                color:
                  setDelta > 0
                    ? 'var(--green)'
                    : setDelta < 0
                      ? 'var(--red)'
                      : 'var(--text-dim)',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {setDelta > 0 ? '+' : ''}
              {setDelta}
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* Modifier visualization */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 16,
                marginBottom: 8,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 160 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}
                >
                  Intensity Modifier
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      color: modifierColor(intensity),
                      fontWeight: 700,
                      fontSize: 18,
                    }}
                  >
                    {intensity.toFixed(3)}×
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    ({(intensity * 100).toFixed(0)}% of planned)
                  </span>
                </div>
                <ModifierBar value={intensity} />
              </div>

              <div style={{ flex: 1, minWidth: 140 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}
                >
                  Set Delta
                </div>
                <span
                  style={{
                    color:
                      setDelta > 0
                        ? 'var(--green)'
                        : setDelta < 0
                          ? 'var(--red)'
                          : 'var(--text-dim)',
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  {setDelta > 0 ? '+' : ''}
                  {setDelta} sets
                </span>
              </div>

              {output?.skipMainLift && (
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 4,
                    }}
                  >
                    Skip Main
                  </div>
                  <span
                    style={{
                      color: 'var(--red)',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    YES
                  </span>
                </div>
              )}

              {output?.llmRestSuggestion && (
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 4,
                    }}
                  >
                    Rest Δ (LLM)
                  </div>
                  <span
                    style={{
                      color:
                        output.llmRestSuggestion.deltaSeconds > 0
                          ? 'var(--green)'
                          : 'var(--red)',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {output.llmRestSuggestion.deltaSeconds > 0 ? '+' : ''}
                    {output.llmRestSuggestion.deltaSeconds}s
                  </span>
                </div>
              )}
            </div>

            {/* Rationale */}
            {rationale.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 6,
                  }}
                >
                  Rationale
                </div>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
                >
                  {rationale.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 8,
                        color: 'var(--text)',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
                        ›
                      </span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input / Output JSON */}
          <div
            style={{
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {input && (
              <JsonViewer
                data={input}
                label="JIT Input Snapshot"
                defaultCollapsed
              />
            )}
            {output && (
              <JsonViewer
                data={output}
                label="JIT Output (planned_sets)"
                defaultCollapsed
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function JITLogs() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('sessions')
        .select(
          'id, user_id, planned_date, status, week_number, block_number, jit_generated_at, jit_strategy, jit_input_snapshot, planned_sets'
        )
        .not('jit_generated_at', 'is', null)
        .order('jit_generated_at', { ascending: false })
        .limit(100);

      if (error) setError(error.message);
      else setSessions((data ?? []) as Session[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered =
    filter === 'all'
      ? sessions
      : sessions.filter((s) => s.jit_strategy === filter);

  const strategies = Array.from(
    new Set(sessions.map((s) => s.jit_strategy).filter(Boolean))
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text-bright)',
              marginBottom: 4,
            }}
          >
            JIT Session Logs
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            Per-session AI-driven workout adjustments — intensity, sets, rest,
            rationale
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', ...strategies].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s ?? '')}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid',
                borderColor: filter === s ? 'var(--accent)' : 'var(--border)',
                background: filter === s ? 'var(--accent-dim)' : 'transparent',
                color: filter === s ? 'var(--accent)' : 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              {s ?? 'formula'}
            </button>
          ))}
        </div>
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
          Loading sessions…
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

      {!loading && !error && filtered.length === 0 && (
        <div
          style={{
            color: 'var(--text-muted)',
            padding: '40px 0',
            textAlign: 'center',
            fontSize: 13,
          }}
        >
          No JIT sessions found. Run a workout to generate logs.
        </div>
      )}

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        className="animate-stagger"
      >
        {filtered.map((s) => (
          <SessionCard key={s.id} session={s} />
        ))}
      </div>
    </div>
  );
}

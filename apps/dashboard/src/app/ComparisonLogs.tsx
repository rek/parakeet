import { useEffect, useState } from 'react';

import type { DbRow } from '@platform/supabase';

import { strategyBadge } from '../components/Badge';
import { JsonViewer } from '../components/JsonViewer';
import { useSupabase } from '../lib/SupabaseContext';
import { theme } from '../lib/theme';

type JITComparisonLog = DbRow<'jit_comparison_logs'>;

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

interface CompOutput {
  intensityModifier?: number;
  setModifier?: number;
  skipMainLift?: boolean;
  rationale?: string[];
}

function DiffValue({
  label,
  formula,
  llm,
  fmt: fmtFn = String,
}: {
  label: string;
  formula: unknown;
  llm: unknown;
  fmt?: (v: unknown) => string;
}) {
  const differ = JSON.stringify(formula) !== JSON.stringify(llm);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span
          style={{
            color: 'var(--blue)',
            padding: '2px 6px',
            background: 'var(--blue-dim)',
            borderRadius: 3,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {formula !== undefined ? fmtFn(formula) : '—'}
        </span>
        {differ && (
          <>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>→</span>
            <span
              style={{
                color: 'var(--green)',
                padding: '2px 6px',
                background: 'var(--green-dim)',
                borderRadius: 3,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {llm !== undefined ? fmtFn(llm) : '—'}
            </span>
            <span
              style={{
                fontSize: 9,
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '1px 5px',
                background: 'var(--accent-dim)',
                borderRadius: 3,
                border: `1px solid ${theme.border.accent}`,
              }}
            >
              DIFF
            </span>
          </>
        )}
        {!differ && (
          <span
            style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}
          >
            ≡ match
          </span>
        )}
      </div>
    </div>
  );
}

function ComparisonCard({ log }: { log: JITComparisonLog }) {
  const [expanded, setExpanded] = useState(false);

  const formula = log.formula_output as CompOutput;
  const llm = log.llm_output as CompOutput;
  const divergence = log.divergence as {
    weightDiff?: number;
    setDelta?: number;
    hasDivergence?: boolean;
  } | null;

  const hasDivergence = divergence?.hasDivergence ?? false;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hasDivergence ? theme.border.purpleStrong : 'var(--border)'}`,
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Header */}
      <button
        className="btn-reset"
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          userSelect: 'none',
          background: hasDivergence ? theme.bg.purpleSubtle : 'transparent',
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
              {fmt(log.created_at)}
            </span>
            {strategyBadge(log.strategy_used)}
            {hasDivergence ? (
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--purple)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '2px 6px',
                  background: 'var(--purple-dim)',
                  borderRadius: 3,
                  border: `1px solid ${theme.border.purpleStrong}`,
                  fontWeight: 700,
                }}
              >
                DIVERGED
              </span>
            ) : (
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--green)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '2px 6px',
                  background: 'var(--green-dim)',
                  borderRadius: 3,
                  border: `1px solid ${theme.border.green}`,
                }}
              >
                CONSENSUS
              </span>
            )}
          </div>
          {log.session_id && (
            <div
              style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2 }}
            >
              session/{log.session_id.slice(0, 8)}…
            </div>
          )}
        </div>

        {/* Quick divergence stats */}
        {hasDivergence && divergence && (
          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            {divergence.weightDiff !== undefined && (
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Wt Diff
                </div>
                <div
                  style={{
                    color: 'var(--purple)',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {(divergence.weightDiff * 100).toFixed(1)}%
                </div>
              </div>
            )}
            {divergence.setDelta !== undefined && (
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Set Δ
                </div>
                <div
                  style={{
                    color: 'var(--purple)',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {divergence.setDelta > 0 ? '+' : ''}
                  {divergence.setDelta}
                </div>
              </div>
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* Side-by-side diff */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0,
              borderBottom: '1px solid var(--border)',
            }}
          >
            {/* Formula column */}
            <div
              style={{
                padding: '14px 16px',
                borderRight: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--blue)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--blue)',
                    display: 'inline-block',
                  }}
                />
                Formula Output
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 2,
                    }}
                  >
                    Intensity
                  </div>
                  <span
                    style={{
                      color: 'var(--blue)',
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {formula.intensityModifier !== undefined
                      ? `${(formula.intensityModifier * 100).toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 2,
                    }}
                  >
                    Set Delta
                  </div>
                  <span
                    style={{
                      color: 'var(--blue)',
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {formula.setModifier !== undefined
                      ? (formula.setModifier > 0 ? '+' : '') +
                        formula.setModifier
                      : '—'}
                  </span>
                </div>
                {formula.rationale && formula.rationale.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 4,
                      }}
                    >
                      Rationale
                    </div>
                    {formula.rationale.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 11,
                          color: 'var(--text-dim)',
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ color: 'var(--blue)', opacity: 0.7 }}>
                          ›{' '}
                        </span>
                        {r}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* LLM column */}
            <div style={{ padding: '14px 16px' }}>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--green)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--green)',
                    display: 'inline-block',
                  }}
                />
                LLM Output (Claude Haiku)
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 2,
                    }}
                  >
                    Intensity
                  </div>
                  <span
                    style={{
                      color:
                        llm.intensityModifier !== formula.intensityModifier
                          ? 'var(--accent)'
                          : 'var(--green)',
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {llm.intensityModifier !== undefined
                      ? `${(llm.intensityModifier * 100).toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 2,
                    }}
                  >
                    Set Delta
                  </div>
                  <span
                    style={{
                      color:
                        llm.setModifier !== formula.setModifier
                          ? 'var(--accent)'
                          : 'var(--green)',
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {llm.setModifier !== undefined
                      ? (llm.setModifier > 0 ? '+' : '') + llm.setModifier
                      : '—'}
                  </span>
                </div>
                {llm.rationale && llm.rationale.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 4,
                      }}
                    >
                      Rationale
                    </div>
                    {llm.rationale.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 11,
                          color: 'var(--text-dim)',
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ color: 'var(--green)', opacity: 0.7 }}>
                          ›{' '}
                        </span>
                        {r}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Diff summary */}
          {hasDivergence && (
            <div
              style={{
                padding: '12px 16px',
                background: theme.bg.purpleSubtle,
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <DiffValue
                label="Intensity"
                formula={formula.intensityModifier}
                llm={llm.intensityModifier}
                fmt={(v) => `${((v as number) * 100).toFixed(1)}%`}
              />
              <DiffValue
                label="Set Delta"
                formula={formula.setModifier}
                llm={llm.setModifier}
                fmt={(v) => `${(v as number) > 0 ? '+' : ''}${v}`}
              />
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
              data={log.jit_input}
              label="JIT Input"
              defaultCollapsed
            />
            <JsonViewer
              data={log.divergence}
              label="Divergence Data"
              defaultCollapsed={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function ComparisonLogs() {
  const { supabase } = useSupabase();
  const [logs, setLogs] = useState<JITComparisonLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyDiverged, setOnlyDiverged] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('jit_comparison_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) setError(error.message);
      else setLogs((data ?? []) as JITComparisonLog[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const filtered = onlyDiverged
    ? logs.filter(
        (l) => (l.divergence as { hasDivergence?: boolean })?.hasDivergence
      )
    : logs;

  const divergedCount = logs.filter(
    (l) => (l.divergence as { hasDivergence?: boolean })?.hasDivergence
  ).length;

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
            Hybrid Comparison Logs
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            Formula vs Claude Haiku — side-by-side divergence analysis
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logs.length > 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {divergedCount}/{logs.length} diverged (
              {((divergedCount / logs.length) * 100).toFixed(0)}%)
            </span>
          )}
          <button
            onClick={() => setOnlyDiverged(!onlyDiverged)}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid',
              borderColor: onlyDiverged ? 'var(--purple)' : 'var(--border)',
              background: onlyDiverged ? 'var(--purple-dim)' : 'transparent',
              color: onlyDiverged ? 'var(--purple)' : 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Diverged Only
          </button>
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
          Loading comparison logs…
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
          No comparison logs. Use strategy: hybrid to generate them.
        </div>
      )}

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        className="animate-stagger"
      >
        {filtered.map((l) => (
          <ComparisonCard key={l.id} log={l} />
        ))}
      </div>
    </div>
  );
}

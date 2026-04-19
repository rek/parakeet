import type { FormCoachingResult } from '@parakeet/training-engine';

import { theme } from '../../lib/theme';
import type { CacheEntry } from '../../lib/coaching-cache';

const GRADE_STYLE: Record<
  'good' | 'acceptable' | 'needs_work',
  { bg: string; fg: string; label: string }
> = {
  good: { bg: theme.bg.greenDim, fg: theme.color.green, label: 'GOOD' },
  acceptable: { bg: theme.bg.blueDim, fg: theme.color.blue, label: 'ACCEPT' },
  needs_work: { bg: theme.bg.redDim, fg: theme.color.red, label: 'WORK' },
};

const PRIORITY_STYLE: Record<
  'high' | 'medium' | 'low',
  { bg: string; fg: string; label: string }
> = {
  high: { bg: theme.bg.redDim, fg: theme.color.red, label: 'HIGH' },
  medium: { bg: theme.bg.blueDim, fg: theme.color.blue, label: 'MED' },
  low: { bg: theme.bg.surfaceRaised, fg: theme.color.textDim, label: 'LOW' },
};

function Pill({
  bg,
  fg,
  children,
}: {
  bg: string;
  fg: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        background: bg,
        color: fg,
        fontSize: 9,
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: 3,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9,
        color: theme.color.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        marginBottom: 6,
        marginTop: 12,
      }}
    >
      {children}
    </div>
  );
}

export function CoachResponseCard({ entry }: { entry: CacheEntry }) {
  const { request, response, latencyMs, tokensIn, tokensOut, error } = entry;

  return (
    <div
      style={{
        background: theme.bg.surface,
        border: `1px solid ${theme.border.base}`,
        borderRadius: 4,
        padding: 14,
        fontFamily: theme.font.mono,
        color: theme.color.text,
        fontSize: 12,
        lineHeight: 1.55,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 10,
          fontSize: 10,
          color: theme.color.textDim,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <span>
          <strong style={{ color: theme.color.accent }}>
            {request.model}
          </strong>{' '}
          · {(latencyMs / 1000).toFixed(2)}s
        </span>
        {tokensIn != null && (
          <span>
            {tokensIn} in / {tokensOut ?? '?'} out
          </span>
        )}
        <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
      </div>

      {error && <ErrorView error={error} />}
      {response && <ResponseBody response={response} />}
    </div>
  );
}

function ErrorView({
  error,
}: {
  error: NonNullable<CacheEntry['error']>;
}) {
  return (
    <div>
      <SectionLabel>Error — {error.kind}</SectionLabel>
      <div style={{ color: theme.color.red, marginBottom: 8 }}>
        {error.message}
      </div>
      {error.raw && (
        <pre
          style={{
            background: theme.bg.base,
            border: `1px solid ${theme.border.base}`,
            padding: 8,
            fontSize: 11,
            overflowX: 'auto',
            color: theme.color.textDim,
          }}
        >
          {error.raw}
        </pre>
      )}
    </div>
  );
}

function ResponseBody({ response }: { response: FormCoachingResult }) {
  return (
    <>
      <SectionLabel>Summary</SectionLabel>
      <div>{response.summary}</div>

      {response.repByRepBreakdown.length > 0 && (
        <>
          <SectionLabel>Per-rep</SectionLabel>
          {response.repByRepBreakdown.map((rep) => {
            const style = GRADE_STYLE[rep.formGrade];
            return (
              <div
                key={rep.repNumber}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 72px 1fr',
                  gap: 10,
                  alignItems: 'start',
                  padding: '6px 0',
                  borderTop: `1px solid ${theme.border.light}`,
                }}
              >
                <span style={{ color: theme.color.textMuted }}>
                  R{rep.repNumber}
                </span>
                <Pill bg={style.bg} fg={style.fg}>
                  {style.label}
                </Pill>
                <span>{rep.assessment}</span>
              </div>
            );
          })}
        </>
      )}

      {response.cues.length > 0 && (
        <>
          <SectionLabel>Cues (sorted by priority)</SectionLabel>
          {[...response.cues]
            .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
            .map((cue, i) => {
              const style = PRIORITY_STYLE[cue.priority];
              return (
                <div
                  key={i}
                  style={{
                    padding: '6px 0',
                    borderTop: `1px solid ${theme.border.light}`,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Pill bg={style.bg} fg={style.fg}>
                      {style.label}
                    </Pill>
                    <span style={{ color: theme.color.textMuted, fontSize: 10 }}>
                      reps {cue.repRange}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, color: theme.color.textDim }}>
                    {cue.observation}
                  </div>
                  <div style={{ marginTop: 2 }}>{cue.cue}</div>
                </div>
              );
            })}
        </>
      )}

      {response.fatigueCorrelation && (
        <>
          <SectionLabel>Fatigue correlation</SectionLabel>
          <div>{response.fatigueCorrelation}</div>
        </>
      )}

      {response.comparedToBaseline && (
        <>
          <SectionLabel>vs baseline</SectionLabel>
          <div>{response.comparedToBaseline}</div>
        </>
      )}

      {response.competitionReadiness && (
        <>
          <SectionLabel>Competition readiness</SectionLabel>
          <div>
            {Math.round(response.competitionReadiness.passRate * 100)}% pass —{' '}
            {response.competitionReadiness.assessment}
          </div>
          {response.competitionReadiness.topConcern && (
            <div style={{ color: theme.color.red, marginTop: 4 }}>
              Top concern: {response.competitionReadiness.topConcern}
            </div>
          )}
        </>
      )}

      <SectionLabel>Next session</SectionLabel>
      <div>{response.nextSessionSuggestion}</div>
    </>
  );
}

function priorityRank(p: 'high' | 'medium' | 'low'): number {
  return p === 'high' ? 0 : p === 'medium' ? 1 : 2;
}

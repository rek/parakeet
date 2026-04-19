import { useCallback, useEffect, useMemo, useState } from 'react';

import type { VideoAnalysisResult } from '@parakeet/shared-types';
import {
  FORM_COACHING_SYSTEM_PROMPT,
  type FormCoachingInput,
} from '@parakeet/training-engine';
import { assembleCoachingContext } from '@modules/video-analysis/application/assemble-coaching-context';

import {
  appendEntry,
  buildCacheEntry,
  findCached,
  getHistory,
  hashRequest,
  type CacheEntry,
} from '../../lib/coaching-cache';
import {
  CoachingError,
  COACHING_MODEL_IDS,
  runCoaching,
  type CoachingModelId,
} from '../../lib/coaching-runner';
import { theme } from '../../lib/theme';

import {
  CoachContextForm,
  type ContextFormValue,
  type Lift,
} from './CoachContextForm';
import { CoachResponseCard } from './CoachResponseCard';

export function CoachPanel({
  fixtureId,
  analysis,
  lift,
  sagittalConfidence,
  previousAnalyses,
}: {
  fixtureId: string;
  analysis: VideoAnalysisResult;
  lift: Lift;
  sagittalConfidence: number;
  previousAnalyses: VideoAnalysisResult[];
}) {
  const [form, setForm] = useState<ContextFormValue | null>(null);
  const [model, setModel] = useState<CoachingModelId>('gpt-5');
  const [showPromptOverride, setShowPromptOverride] = useState(false);
  const [promptOverride, setPromptOverride] = useState<string>(
    FORM_COACHING_SYSTEM_PROMPT
  );
  const [history, setHistory] = useState<CacheEntry[]>(() =>
    getHistory(fixtureId)
  );
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  // Reload history when the fixture changes.
  useEffect(() => {
    setHistory(getHistory(fixtureId));
    setActiveEntryId(null);
    setTopError(null);
  }, [fixtureId]);

  const assembled = useMemo<FormCoachingInput | null>(() => {
    if (!form) return null;
    return assembleCoachingContext({
      analysis,
      lift,
      sagittalConfidence,
      oneRmKg: form.oneRmKg,
      biologicalSex: form.biologicalSex,
      session: {
        block_number: form.blockNumber,
        week_number: form.weekNumber,
        intensity_type: form.intensityType,
        is_deload: form.isDeload,
      },
      log: {
        session_rpe: form.sessionRpe,
        actual_sets: form.weightKg != null ? [{ weight_kg: form.weightKg }] : [],
      },
      jitSnapshot: {
        sorenessRatings: form.sorenessRatings,
        sleepQuality: form.sleepQuality ?? undefined,
        energyLevel: form.energyLevel ?? undefined,
        activeDisruptions: form.activeDisruptions,
      },
      previousAnalyses: form.usePriorFixtures ? previousAnalyses : [],
    });
  }, [form, analysis, lift, sagittalConfidence, previousAnalyses]);

  const promptIsModified = promptOverride !== FORM_COACHING_SYSTEM_PROMPT;

  const onGenerate = useCallback(
    async ({ forceRefresh }: { forceRefresh: boolean }) => {
      if (!assembled) return;
      setTopError(null);
      setBusy(true);
      const request = {
        context: assembled,
        model,
        systemPrompt: promptOverride,
      };
      try {
        const hash = await hashRequest(request);
        if (!forceRefresh) {
          const cached = findCached(fixtureId, hash);
          if (cached) {
            setActiveEntryId(cached.id);
            setBusy(false);
            return;
          }
        }

        const run = await runCoaching({
          context: assembled,
          model,
          systemPromptOverride: promptIsModified ? promptOverride : undefined,
        });
        const entry = buildCacheEntry({ run, requestHash: hash });
        appendEntry(fixtureId, entry);
        setHistory(getHistory(fixtureId));
        setActiveEntryId(entry.id);
      } catch (err) {
        if (err instanceof CoachingError) {
          // Persist error entries too so we can inspect them later.
          const hash = await hashRequest(request);
          const entry: CacheEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            requestHash: hash,
            request,
            response: null,
            latencyMs: 0,
            tokensIn: null,
            tokensOut: null,
            error: {
              kind: err.kind,
              message: err.message,
              raw: err.raw,
            },
          };
          appendEntry(fixtureId, entry);
          setHistory(getHistory(fixtureId));
          setActiveEntryId(entry.id);
          setTopError(err.message);
        } else {
          setTopError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setBusy(false);
      }
    },
    [assembled, model, promptOverride, promptIsModified, fixtureId]
  );

  const activeEntry =
    history.find((e) => e.id === activeEntryId) ?? history[0] ?? null;

  return (
    <section
      style={{
        marginTop: 16,
        padding: 14,
        background: theme.bg.surfaceRaised,
        border: `1px solid ${theme.border.base}`,
        borderLeft: `3px solid ${theme.color.purple}`,
        borderRadius: 4,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: theme.color.purple,
          marginBottom: 10,
        }}
      >
        Coach {promptIsModified && <em style={{ opacity: 0.7 }}>· modified prompt</em>}
      </div>

      <CoachContextForm
        fixtureId={fixtureId}
        lift={lift}
        onChange={setForm}
      />

      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginTop: 12,
          flexWrap: 'wrap',
        }}
      >
        <label style={{ fontSize: 10, color: theme.color.textMuted }}>
          MODEL{' '}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as CoachingModelId)}
            style={{
              background: theme.bg.base,
              border: `1px solid ${theme.border.base}`,
              color: theme.color.text,
              fontFamily: theme.font.mono,
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 3,
              marginLeft: 6,
            }}
          >
            {COACHING_MODEL_IDS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setShowPromptOverride((v) => !v)}
          style={btn('ghost')}
        >
          {showPromptOverride ? 'hide prompt' : 'edit prompt'}
        </button>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          disabled={busy || !assembled}
          onClick={() => onGenerate({ forceRefresh: false })}
          style={btn('primary')}
        >
          {busy ? 'running…' : 'Generate'}
        </button>
        <button
          type="button"
          disabled={busy || !assembled}
          onClick={() => onGenerate({ forceRefresh: true })}
          style={btn('ghost')}
          title="Bypass cache and call the LLM even for a previously-seen request"
        >
          Force refresh
        </button>
      </div>

      {showPromptOverride && (
        <div style={{ marginTop: 10 }}>
          <textarea
            value={promptOverride}
            onChange={(e) => setPromptOverride(e.target.value)}
            rows={8}
            style={{
              width: '100%',
              background: theme.bg.base,
              border: `1px solid ${theme.border.base}`,
              color: theme.color.text,
              fontFamily: theme.font.mono,
              fontSize: 11,
              padding: 8,
              borderRadius: 3,
            }}
          />
          <button
            type="button"
            onClick={() => setPromptOverride(FORM_COACHING_SYSTEM_PROMPT)}
            style={{ ...btn('ghost'), marginTop: 6 }}
          >
            Reset to default
          </button>
        </div>
      )}

      {topError && (
        <div
          style={{
            marginTop: 10,
            padding: 8,
            border: `1px solid ${theme.border.red}`,
            color: theme.color.red,
            borderRadius: 3,
            fontSize: 11,
          }}
        >
          {topError}
        </div>
      )}

      {activeEntry && (
        <div style={{ marginTop: 14 }}>
          <CoachResponseCard entry={activeEntry} />
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: theme.color.textMuted,
              marginBottom: 6,
            }}
          >
            History (last {history.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {history.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setActiveEntryId(entry.id)}
                style={{
                  textAlign: 'left',
                  background:
                    entry.id === activeEntry?.id
                      ? theme.bg.surfaceHover
                      : 'transparent',
                  border: `1px solid ${theme.border.light}`,
                  color: theme.color.textDim,
                  fontFamily: theme.font.mono,
                  fontSize: 11,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  borderRadius: 2,
                }}
              >
                <span style={{ color: theme.color.accent }}>
                  {entry.request.model}
                </span>{' '}
                · {(entry.latencyMs / 1000).toFixed(2)}s ·{' '}
                {new Date(entry.timestamp).toLocaleTimeString()}
                {entry.error && (
                  <span style={{ color: theme.color.red }}>
                    {' '}
                    · {entry.error.kind}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function btn(variant: 'primary' | 'ghost'): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: theme.font.mono,
    fontSize: 11,
    padding: '5px 10px',
    borderRadius: 3,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };
  if (variant === 'primary') {
    return {
      ...base,
      background: theme.bg.purpleDim,
      border: `1px solid ${theme.border.purple}`,
      color: theme.color.purple,
    };
  }
  return {
    ...base,
    background: 'transparent',
    border: `1px solid ${theme.border.base}`,
    color: theme.color.textDim,
  };
}

import { useEffect, useState } from 'react';

import { theme } from '../../lib/theme';

export type Lift = 'squat' | 'bench' | 'deadlift';

export interface ContextFormValue {
  weightKg: number | null;
  targetReps: number;
  sessionRpe: number;
  oneRmKg: number | null;
  biologicalSex: 'male' | 'female' | null;
  blockNumber: number | null;
  weekNumber: number | null;
  intensityType: string | null;
  sorenessRatings: Record<string, number>;
  sleepQuality: number | null;
  energyLevel: number | null;
  activeDisruptions: Array<{ disruption_type: string; severity: string }>;
  usePriorFixtures: boolean;
  priorFixtureCount: 3 | 5 | 10;
  isDeload: boolean;
}

const STORAGE_PREFIX = 'dashboard.coaching.context';

function defaultsForLift(lift: Lift): ContextFormValue {
  const liftWeight: Record<Lift, number> = {
    squat: 140,
    bench: 100,
    deadlift: 160,
  };
  return {
    weightKg: liftWeight[lift],
    targetReps: 5,
    sessionRpe: 8,
    oneRmKg: null,
    biologicalSex: null,
    blockNumber: null,
    weekNumber: null,
    intensityType: null,
    sorenessRatings: {},
    sleepQuality: null,
    energyLevel: null,
    activeDisruptions: [],
    usePriorFixtures: false,
    priorFixtureCount: 5,
    isDeload: false,
  };
}

function loadSaved(fixtureId: string, lift: Lift): ContextFormValue {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}.${fixtureId}`);
  if (!raw) return defaultsForLift(lift);
  try {
    const parsed = JSON.parse(raw) as Partial<ContextFormValue>;
    return { ...defaultsForLift(lift), ...parsed };
  } catch {
    return defaultsForLift(lift);
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: theme.bg.base,
  border: `1px solid ${theme.border.base}`,
  borderRadius: 3,
  padding: '6px 8px',
  color: theme.color.text,
  fontFamily: theme.font.mono,
  fontSize: 12,
};

const labelSpanStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: theme.color.textMuted,
  marginBottom: 4,
  display: 'block',
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span style={labelSpanStyle}>{label}</span>
      {children}
    </label>
  );
}

export function CoachContextForm({
  fixtureId,
  lift,
  onChange,
}: {
  fixtureId: string;
  lift: Lift;
  onChange: (value: ContextFormValue) => void;
}) {
  const [value, setValue] = useState<ContextFormValue>(() =>
    loadSaved(fixtureId, lift)
  );

  useEffect(() => {
    const next = loadSaved(fixtureId, lift);
    setValue(next);
    onChange(next);
  }, [fixtureId, lift, onChange]);

  const update = (patch: Partial<ContextFormValue>) => {
    const next = { ...value, ...patch };
    setValue(next);
    localStorage.setItem(
      `${STORAGE_PREFIX}.${fixtureId}`,
      JSON.stringify(next)
    );
    onChange(next);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
        padding: 12,
        background: theme.bg.surface,
        border: `1px solid ${theme.border.base}`,
        borderRadius: 4,
      }}
    >
      <Field label="Weight (kg)">
        <input
          type="number"
          step="0.5"
          value={value.weightKg ?? ''}
          onChange={(e) =>
            update({
              weightKg: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          style={inputStyle}
        />
      </Field>
      <Field label="Target reps">
        <input
          type="number"
          min={1}
          max={20}
          value={value.targetReps}
          onChange={(e) => update({ targetReps: Number(e.target.value) })}
          style={inputStyle}
        />
      </Field>
      <Field label="Set RPE (5–10)">
        <input
          type="number"
          min={5}
          max={10}
          step="0.5"
          value={value.sessionRpe}
          onChange={(e) => update({ sessionRpe: Number(e.target.value) })}
          style={inputStyle}
        />
      </Field>
      <Field label="1RM (kg)">
        <input
          type="number"
          step="0.5"
          value={value.oneRmKg ?? ''}
          onChange={(e) =>
            update({
              oneRmKg: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          style={inputStyle}
        />
      </Field>
      <Field label="Biological sex">
        <select
          value={value.biologicalSex ?? ''}
          onChange={(e) =>
            update({
              biologicalSex:
                e.target.value === ''
                  ? null
                  : (e.target.value as 'male' | 'female'),
            })
          }
          style={inputStyle}
        >
          <option value="">—</option>
          <option value="male">male</option>
          <option value="female">female</option>
        </select>
      </Field>
      <Field label="Block">
        <input
          type="number"
          value={value.blockNumber ?? ''}
          onChange={(e) =>
            update({
              blockNumber:
                e.target.value === '' ? null : Number(e.target.value),
            })
          }
          style={inputStyle}
        />
      </Field>
      <Field label="Week">
        <input
          type="number"
          value={value.weekNumber ?? ''}
          onChange={(e) =>
            update({
              weekNumber: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          style={inputStyle}
        />
      </Field>
      <Field label="Intensity type">
        <input
          type="text"
          value={value.intensityType ?? ''}
          onChange={(e) =>
            update({
              intensityType: e.target.value === '' ? null : e.target.value,
            })
          }
          placeholder="hypertrophy / intensity / ..."
          style={inputStyle}
        />
      </Field>
      <Field label="Deload?">
        <select
          value={value.isDeload ? 'yes' : 'no'}
          onChange={(e) => update({ isDeload: e.target.value === 'yes' })}
          style={inputStyle}
        >
          <option value="no">no</option>
          <option value="yes">yes</option>
        </select>
      </Field>
      <Field label="Sleep (0–10)">
        <input
          type="number"
          min={0}
          max={10}
          value={value.sleepQuality ?? ''}
          onChange={(e) =>
            update({
              sleepQuality:
                e.target.value === '' ? null : Number(e.target.value),
            })
          }
          style={inputStyle}
        />
      </Field>
      <Field label="Energy (0–10)">
        <input
          type="number"
          min={0}
          max={10}
          value={value.energyLevel ?? ''}
          onChange={(e) =>
            update({
              energyLevel:
                e.target.value === '' ? null : Number(e.target.value),
            })
          }
          style={inputStyle}
        />
      </Field>
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <label
          style={{
            fontSize: 11,
            color: theme.color.textDim,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <input
            type="checkbox"
            checked={value.usePriorFixtures}
            onChange={(e) => update({ usePriorFixtures: e.target.checked })}
          />
          Include last
          <select
            disabled={!value.usePriorFixtures}
            value={value.priorFixtureCount}
            onChange={(e) =>
              update({
                priorFixtureCount: Number(e.target.value) as 3 | 5 | 10,
              })
            }
            style={{ ...inputStyle, width: 56, padding: '2px 4px' }}
          >
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
          same-lift fixtures as longitudinal context
        </label>
      </div>
    </div>
  );
}

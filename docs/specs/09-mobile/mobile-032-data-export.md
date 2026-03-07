# Spec: Data Export

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

A one-tap data export from Settings that writes all completed session logs to a JSON file and opens the native OS share sheet.

## Dependencies

- `expo-file-system` (already installed) — writes file to cache directory
- `expo-sharing` (already installed) — opens native share sheet
- `getCompletedSessions` pattern from `lib/sessions.ts`

## Implementation

### ✅ `apps/parakeet/src/modules/settings/data/export.repository.ts`

Queries all `sessions` with `status = 'completed'` joined with `session_logs`:

```ts
export async function fetchCompletedSessionsForExport(userId: string): Promise<ExportSessionRow[]>
```

Returns `ExportSessionRow[]` with `primary_lift`, `planned_date`, `completed_at`, `intensity_type`, and nested `session_logs` (actual_sets, auxiliary_sets, session_rpe).

### ✅ `apps/parakeet/src/modules/settings/application/export.service.ts`

```ts
export async function exportTrainingData(userId: string): Promise<void>
```

- Fetches rows via `fetchCompletedSessionsForExport`
- Converts `weight_grams` → `weight_kg` using `gramsToKg` from training-engine
- Writes `parakeet-export-YYYY-MM-DD.json` to `Paths.cache`
- Calls `Sharing.shareAsync()` with `mimeType: 'application/json'`
- Throws if sharing is not available on device

### ✅ `apps/parakeet/src/app/(tabs)/settings.tsx`

- "Export Data" row in the **Account** section
- `isExporting` state shows "Exporting…" label while in progress
- Calls `exportTrainingData(user.id)` on press

## Export JSON Shape

```json
{
  "exported_at": "2026-03-07T10:00:00.000Z",
  "version": 1,
  "sessions": [
    {
      "date": "2026-02-28",
      "lift": "squat",
      "intensity_type": "heavy",
      "completed_at": "2026-02-28T09:30:00.000Z",
      "session_rpe": 8,
      "sets": [
        { "set_number": 1, "weight_kg": 175, "reps": 3, "rpe": 8 }
      ],
      "auxiliary_sets": [...]
    }
  ]
}
```

All weights in kg (decimal). `session_rpe`, `rpe`, and `auxiliary_sets` are omitted when not recorded.

## Acceptance Gates

- Settings → Export Data opens native share sheet
- Exported file is valid JSON matching the shape above
- "Exporting…" label shown while in progress
- Empty sessions array if user has no completed sessions

# Spec: Formula Editor Screen

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

The formula editor screen in Settings where users view, understand, and override Cube Method loading parameters. Also displays AI suggestions.

## Tasks

**`apps/parakeet/app/formula/editor.tsx`:**
- Tabs or accordion sections: Block 1 | Block 2 | Block 3 | Deload
- Navigation to this screen from Settings tab → "Manage Formulas"

**Per block section:**
- Three rows: Heavy | Explosive | Rep
- Each row shows key fields in plain language:
  - "80% of max — 2 sets × 5 reps — RPE 8.5"
- Sample session card below each intensity row:
  - Uses user's current Squat 1RM to show a concrete example weight
  - Updates live as the user edits parameters
- Edit mode: tap any row → inline numeric inputs appear (percentage as %, sets as integer, reps as integer or range)
- Save button: enabled when any value has changed from the currently active config

**Save flow:**
- Tap "Save" → bottom sheet appears:
  - "Create new formula version" (default) with optional toggle: "Regenerate program with new formula"
  - Confirm → call `createFormulaOverride(userId, { overrides, source: 'user' })` from `apps/parakeet/lib/formulas.ts`
  - If regenerate checked: call `regenerateProgram(programId)` from `apps/parakeet/lib/programs.ts` after config save
  - Success toast: "Formula updated — Program regenerated"

**History tab (within formula editor):**
- List of all formula config versions (newest first)
- Each item: date, source badge (User / AI Suggestion / System), brief change summary
- Tap version → view full parameters for that version
- "Reactivate" button on historical versions → `deactivateFormulaConfig(currentActiveId, userId)` then `createFormulaOverride()` with the selected version's overrides

**AI Suggestions tab:**
- List of pending AI suggestions (formula_configs rows where `source='ai_suggestion'` and `is_active=false`)
- Each suggestion: affected parameter, current value, suggested value, rationale text
- "Accept" → calls `createFormulaOverride(userId, { overrides: suggestion.overrides, source: 'ai_suggestion' })` from `apps/parakeet/lib/formulas.ts`
- "Dismiss" → calls `deactivateFormulaConfig(suggestionId, userId)` (marks the suggestion row inactive)
- Red dot badge on Settings tab when unreviewed suggestions exist

## Dependencies

- [formulas-002-config-api.md](../05-data/formulas-002-config-api.md)
- [parakeet-001-expo-router-layout.md](./parakeet-001-expo-router-layout.md)

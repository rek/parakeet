## Dashboard

- Timeline — chronological feed of all AI events with colored dots + stat cards at top
- JIT Sessions — per-session adjustments with intensity bar visualization, set delta, rationale bullets, and expandable input/output JSON
- Hybrid Comparisons — side-by-side Formula vs LLM diff with divergence highlighting and DIVERGED/CONSENSUS badges
- Cycle Reviews — full Sonnet output: assessment, lift ratings, formula suggestions, structural suggestions, next-cycle recs
- Formula Suggestions — AI-proposed formula overrides with active/inactive status and parameter key-value display
- Developer Suggestions — priority-sorted structural feedback with colored left border and dev notes

Aesthetic: near-black with amber gold accents, JetBrains Mono throughout, collapsible JSON trees, subtle noise texture, staggered fade-in animations.

## Setup

Get keys:

```sh
npx supabase status -o env
```

for `.env.local`

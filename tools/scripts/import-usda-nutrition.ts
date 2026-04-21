/**
 * Import macro data for diet_foods from USDA FoodData Central SR Legacy.
 *
 * Input:
 *   - tools/data/usda/FoodData_Central_sr_legacy_food_csv_2018-04/
 *       food.csv, nutrient.csv, food_nutrient.csv
 *   - tools/data/rad.csv + tools/data/keto.csv (food allowlists)
 *
 * Output:
 *   - tools/data/food_nutrition.csv (per-100g macro rows for each food
 *     that matched a USDA entry, with a confidence column)
 *   - tools/data/food_nutrition_unmatched.txt (list of foods that did
 *     not match — fill manually from IFCT 2017 etc.)
 *
 * Run:
 *   npm run db:import:usda
 *
 * Nutrient IDs we care about (per-100g, all SR Legacy):
 *   1008 — Energy (kcal)
 *   1003 — Protein (g)
 *   1004 — Total lipid / fat (g)
 *   1005 — Carbohydrate by difference (g)
 *   1079 — Fiber, total dietary (g)
 *
 * The importer is forgiving: re-runnable, preserves existing
 * food_nutrition.csv rows for foods already matched (skip), and only
 * writes new matches + emits the unmatched list.
 */

import * as fs from 'fs';
import * as path from 'path';

import { parseQuotedCsv } from './lib/parse-diet-csv';

const DATA_DIR = path.resolve(__dirname, '../data');
const USDA_DIR = path.join(
  DATA_DIR,
  'usda/FoodData_Central_sr_legacy_food_csv_2018-04',
);
const OUT_PATH = path.join(DATA_DIR, 'food_nutrition.csv');
const UNMATCHED_PATH = path.join(DATA_DIR, 'food_nutrition_unmatched.txt');

const NUTRIENT_IDS = {
  kcal: '1008',
  protein_g: '1003',
  fat_g: '1004',
  carb_g: '1005',
  fiber_g: '1079',
} as const;

const OUTPUT_HEADER =
  'canonical_name,serving_g,kcal,protein_g,fat_g,carb_g,fiber_g,source,source_id,confidence,usda_description';

// ---------------------------------------------------------------------------
// Load diet_foods canonical list (union of rad.csv + keto.csv)
// ---------------------------------------------------------------------------

function canonical(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

function loadDietFoodCanonicals(): Set<string> {
  const canonicals = new Set<string>();
  for (const file of ['rad.csv', 'keto.csv']) {
    const lines = fs
      .readFileSync(path.join(DATA_DIR, file), 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    for (const line of lines.slice(1)) {
      const parts = line.split(',');
      if (parts.length < 3) continue;
      const food = parts[1].trim();
      if (food) canonicals.add(canonical(food));
    }
  }
  return canonicals;
}

// ---------------------------------------------------------------------------
// Load existing food_nutrition.csv to skip already-matched rows
// ---------------------------------------------------------------------------

function loadExistingMatched(): Map<string, string> {
  if (!fs.existsSync(OUT_PATH)) return new Map();
  const rows = parseQuotedCsv(fs.readFileSync(OUT_PATH, 'utf8')).filter((r) =>
    r.some((c) => c.length > 0),
  );
  const existing = new Map<string, string>();
  for (const row of rows.slice(1)) {
    const canon = row[0]?.trim();
    if (canon) existing.set(canon, rows.slice(1).indexOf(row).toString());
  }
  return existing;
}

// ---------------------------------------------------------------------------
// USDA data loaders
// ---------------------------------------------------------------------------

interface UsdaFood {
  fdc_id: string;
  description: string;
}

function loadUsdaFoods(): UsdaFood[] {
  const rows = parseQuotedCsv(
    fs.readFileSync(path.join(USDA_DIR, 'food.csv'), 'utf8'),
  ).filter((r) => r.some((c) => c.length > 0));
  return rows.slice(1).map((r) => ({
    fdc_id: r[0],
    description: r[2],
  }));
}

/**
 * Stream food_nutrient.csv and collect the 5 macro rows per fdc_id.
 * The CSV is 34 MB and 644k rows — reading it all at once is fine in
 * Node (~200 MB peak RSS), but we still skip non-target nutrient IDs
 * early to keep the hot map small.
 */
function loadUsdaMacros(): Map<string, Partial<Record<string, number>>> {
  const wanted = new Set(Object.values(NUTRIENT_IDS));
  const text = fs.readFileSync(
    path.join(USDA_DIR, 'food_nutrient.csv'),
    'utf8',
  );
  const lines = text.split('\n');
  const byFdc = new Map<string, Partial<Record<string, number>>>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // Row format (SR Legacy food_nutrient.csv):
    //   "id","fdc_id","nutrient_id","amount","data_points","derivation_id","min","max","median","footnote","min_year_acquired"
    // Quoted numeric fields; simple split on ,"" is adequate here.
    const parts = line.split(',');
    if (parts.length < 4) continue;
    const nutId = parts[2].replace(/"/g, '');
    if (!wanted.has(nutId)) continue;
    const fdc = parts[1].replace(/"/g, '');
    const amount = Number.parseFloat(parts[3].replace(/"/g, ''));
    if (!Number.isFinite(amount)) continue;
    const bucket = byFdc.get(fdc) ?? {};
    bucket[nutId] = amount;
    byFdc.set(fdc, bucket);
  }
  return byFdc;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'and',
  'or',
  'with',
  'the',
  'a',
  'of',
  'in',
  'raw',
  'cooked',
  'fresh',
  'frozen',
  'canned',
]);

// Canonical-name → broader token set. Lets the matcher find USDA rows
// where the vocabulary doesn't overlap 1:1 (e.g. "pistachios" → USDA's
// "Nuts, pistachio nuts"; "mangoes" → "Mangos, raw"). Add aliases as
// unmatched-list drives.
const ALIASES: Record<string, string[]> = {
  'mangoes': ['mangos', 'raw'],
  'pistachios': ['nuts', 'pistachio'],
  'beetroot': ['beets'],
  'capsicum': ['peppers', 'sweet'],
  'sardines': ['fish', 'sardine'],
  'aged cheeses': ['cheese', 'parmesan'],
  'hard aged cheeses': ['cheese', 'parmesan'],
  'goat or sheep dairy': ['milk', 'goat'],
  'goji berry powder': ['goji', 'berries', 'dried'],
  'homemade millet sourdough': ['bread', 'whole', 'wheat'],
  'babaganoush (fresh local)': ['eggplant', 'raw'],
};

function stripPlural(t: string): string {
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 4 && t.endsWith('es')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map(stripPlural);
}

function expandCanonical(canon: string): string[] {
  const alias = ALIASES[canon];
  // When an alias exists, it overrides base tokens — avoids dilution
  // from irrelevant parts of the canonical name (e.g. "(fresh local)"
  // suffix on a recipe, or "aged" on "aged cheeses" that isn't in the
  // USDA description).
  if (alias) return [...new Set(alias.map(stripPlural))];
  return tokenize(canon);
}

/**
 * Score a USDA description against a canonical diet-food name.
 * Higher = better match. Simple token-overlap score weighted by
 * inverse description length (prefer specific, short USDA entries
 * over verbose prep-laden ones).
 */
function scoreMatch(canonical: string, description: string): number {
  const wantTokens = new Set(expandCanonical(canonical));
  if (wantTokens.size === 0) return 0;
  const haveTokens = tokenize(description);
  let overlap = 0;
  for (const t of haveTokens) if (wantTokens.has(t)) overlap++;
  if (overlap === 0) return 0;
  // Coverage ratio of our tokens found in the description.
  const coverage = overlap / wantTokens.size;
  // Tie-breaker: prefer short descriptions (fewer irrelevant tokens).
  const brevity = 10 / (10 + haveTokens.length);
  return coverage * 100 + brevity * 5;
}

interface Match {
  fdc_id: string;
  description: string;
  score: number;
}

function bestMatch(canon: string, foods: UsdaFood[]): Match | null {
  let best: Match | null = null;
  for (const f of foods) {
    const score = scoreMatch(canon, f.description);
    if (score === 0) continue;
    if (!best || score > best.score) {
      best = { fdc_id: f.fdc_id, description: f.description, score };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// CSV output
// ---------------------------------------------------------------------------

function quoteCsvField(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function formatRow(
  canon: string,
  kcal: number,
  protein: number,
  fat: number,
  carb: number,
  fiber: number | null,
  sourceId: string,
  confidence: number,
  description: string,
): string {
  return [
    quoteCsvField(canon),
    '100',
    kcal.toFixed(1),
    protein.toFixed(2),
    fat.toFixed(2),
    carb.toFixed(2),
    fiber === null ? '' : fiber.toFixed(2),
    'USDA_SR',
    sourceId,
    confidence.toFixed(1),
    quoteCsvField(description),
  ].join(',');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(USDA_DIR)) {
    console.error(`USDA data missing at ${USDA_DIR}`);
    console.error(
      'Download the SR Legacy CSV from https://fdc.nal.usda.gov/download-datasets.html',
    );
    console.error('and unzip it into tools/data/usda/.');
    process.exit(1);
  }

  const diet = loadDietFoodCanonicals();
  console.log(`diet_foods: ${diet.size} canonicals`);

  const existingRows = fs.existsSync(OUT_PATH)
    ? parseQuotedCsv(fs.readFileSync(OUT_PATH, 'utf8')).filter((r) =>
        r.some((c) => c.length > 0),
      )
    : [];
  const existing = new Map<string, string[]>();
  for (const row of existingRows.slice(1)) {
    if (row[0]) existing.set(canonical(row[0]), row);
  }
  console.log(`existing matches preserved: ${existing.size}`);

  console.log('loading USDA food.csv...');
  const foods = loadUsdaFoods();
  console.log(`USDA foods: ${foods.length}`);

  console.log('loading USDA food_nutrient.csv (~35 MB, ~15 s)...');
  const macros = loadUsdaMacros();
  console.log(`USDA foods with ≥1 macro: ${macros.size}`);

  const output: string[] = [OUTPUT_HEADER];
  const unmatched: string[] = [];
  const MIN_CONFIDENCE = 40; // out of 105
  let autoMatched = 0;

  for (const canon of [...diet].sort()) {
    if (existing.has(canon)) {
      // Preserve the hand-validated row verbatim.
      const row = existing.get(canon)!;
      // Pad to header length in case older rows had fewer columns.
      while (row.length < 11) row.push('');
      output.push(row.map(quoteCsvField).join(','));
      continue;
    }
    const best = bestMatch(canon, foods);
    if (!best || best.score < MIN_CONFIDENCE) {
      unmatched.push(canon);
      continue;
    }
    const m = macros.get(best.fdc_id);
    if (!m || m[NUTRIENT_IDS.kcal] === undefined) {
      unmatched.push(canon);
      continue;
    }
    const kcal = m[NUTRIENT_IDS.kcal] ?? 0;
    const protein = m[NUTRIENT_IDS.protein_g] ?? 0;
    const fat = m[NUTRIENT_IDS.fat_g] ?? 0;
    const carb = m[NUTRIENT_IDS.carb_g] ?? 0;
    const fiber = m[NUTRIENT_IDS.fiber_g] ?? null;
    output.push(
      formatRow(
        canon,
        kcal,
        protein,
        fat,
        carb,
        fiber,
        best.fdc_id,
        best.score,
        best.description,
      ),
    );
    autoMatched++;
  }

  fs.writeFileSync(OUT_PATH, output.join('\n') + '\n');
  fs.writeFileSync(
    UNMATCHED_PATH,
    unmatched.length === 0
      ? '# all diet_foods matched\n'
      : `# ${unmatched.length} foods need manual fill (IFCT_2017 or other)\n` +
          unmatched.map((c) => `- ${c}`).join('\n') +
          '\n',
  );
  console.log(
    `wrote ${output.length - 1} rows to food_nutrition.csv ` +
      `(${autoMatched} auto-matched, ${existing.size} preserved)`,
  );
  console.log(
    `${unmatched.length} unmatched foods listed in food_nutrition_unmatched.txt`,
  );
}

main();

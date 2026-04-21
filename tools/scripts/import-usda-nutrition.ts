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
/**
 * Canonical → USDA `fdc_id` hard pin. Bypasses fuzzy matching entirely.
 * Used for foods where:
 *   - The canonical is ambiguous (e.g. "rice" → brown long-grain cooked
 *     is the sensible default, not "Snacks, rice cracker brown rice,
 *     plain" which the fuzzy matcher scores high on coverage).
 *   - Multiple similar USDA entries exist and we want to lock in one.
 *   - The fuzzy matcher keeps picking a weirdly-named branded item.
 *
 * Preferred pattern: use a single plain row (raw or basic-cooked) so
 * the target macro-calc reflects the food as normally eaten.
 */
const FORCE_FDC: Record<string, string> = {
  'rice': '169704', // Rice, brown, long-grain, cooked
  'honey': '169640', // Honey
  'oats': '169705', // Oats
  'onions and garlic': '170000', // Onions, raw
  'lemon and lime': '167746', // Lemons, raw, without peel
  'fresh lemon juice': '167746', // Lemons, raw — same, juice macros approximate
  'peanuts and natural peanut butter': '172470', // Peanut butter, smooth, no salt
  'pomegranate': '169134', // Pomegranates, raw
  'tofu and tofu skins': '172476', // Tofu, raw, regular
  'flaxseeds and flaxseed meal': '169414', // Seeds, flaxseed
  'corn': '169999', // Corn, sweet, yellow, cooked, no salt
  'corn products': '169999',
  'sweet potatoes': '168482', // Sweet potato, raw, unprepared
  'salmon': '173686', // Fish, salmon, Atlantic, wild, raw
  'other fatty fish': '173686',
  'mackerel': '175119', // Fish, mackerel, Atlantic, raw
  'sardines': '175139', // Fish, sardine, Atlantic, canned in oil
  'beetroot': '169145', // Beets, raw
  'aubergine/eggplant': '169228', // Eggplant, raw
  'babaganoush (fresh local)': '169228',
  'mangoes': '169910', // Mangos, raw
  'pineapple': '169124', // Pineapple, raw, all varieties
  'berries': '167762', // Strawberries, raw — proxy for generic berries
  'green apple': '171688', // Apples, raw, with skin
  'green beans': '169961', // Beans, snap, green, raw
  'peas in volume': '170419', // Peas, green, raw
  'chickpeas': '173757', // Chickpeas, mature, cooked, boiled, no salt
  'chickpeas/kabuli chana': '173757',
  'black chickpeas/kala chana': '173757',
  'buffalo/buff meat': '175299', // Game meat, buffalo, water, raw
  'goat / chevon (lean cuts)': '175303', // Game meat, goat, raw
  'mushrooms (all varieties)': '169251', // Mushrooms, white, raw
  'kale powder': '169237', // Kale, raw (fallback: powder approximates kale)
  'brie and camembert': '172178', // Cheese, camembert
  'fresh unfermented cow milk cheese': '170847', // Cheese, mozzarella, part skim
  'homemade buffalo milk paneer': '170847',
  'spinach': '168462',
  'vegetable oil': '171411', // Oil, soybean, salad or cooking (generic veg oil)
  'olive oil vinaigrette': '171413', // Oil, olive, salad or cooking
};

const ALIASES: Record<string, string[]> = {
  'aubergine/eggplant': ['eggplant', 'raw'],
  'bitter gourd/karela': ['balsam', 'pear', 'bitter', 'gourd'],
  'brie and camembert': ['cheese', 'brie'],
  'chicken and poultry': ['chicken', 'broilers', 'fryers', 'breast', 'meat', 'raw'],
  'clean bratwurst': ['sausage', 'bratwurst', 'pork'],
  'clean natural sausage': ['sausage', 'italian', 'pork'],
  'fresh unfermented cow milk cheese': ['cheese', 'mozzarella'],
  'goat / chevon (lean cuts)': ['goat', 'raw'],
  'homemade buffalo milk paneer': ['cheese', 'ricotta', 'part', 'skim'],
  'kale powder': ['kale', 'raw'],
  'pea-brown rice protein powder': ['rice', 'brown', 'long', 'grain', 'raw'],
  'regular sourdough': ['bread', 'whole', 'wheat'],
  'millet pancakes': ['millet', 'cooked'],
  'chickpeas': ['chickpeas', 'mature', 'boiled'],
  'flaxseeds and flaxseed meal': ['seeds', 'flaxseed'],
  'corn': ['corn', 'sweet', 'yellow', 'cooked', 'drained'],
  'corn products': ['corn', 'sweet', 'yellow', 'cooked', 'drained'],
  'honey': ['honey', 'strained'],
  'mustard': ['mustard', 'prepared', 'yellow'],
  'oats': ['oats'],
  'onions and garlic': ['onions', 'raw'],
  'peanuts and natural peanut butter': ['peanut', 'butter', 'smooth'],
  'peas in volume': ['peas', 'green', 'cooked', 'drained'],
  'pomegranate': ['pomegranates', 'raw'],
  'rice': ['rice', 'brown', 'long', 'cooked'],
  'sweet potatoes': ['sweet', 'potato', 'raw', 'unprepared'],
  'tofu and tofu skins': ['tofu', 'firm', 'prepared'],
  'green beans': ['beans', 'snap', 'green', 'raw'],
  'lemon and lime': ['lemons', 'raw'],
  'olive oil vinaigrette': ['oil', 'olive', 'salad'],
  'vegetable oil': ['oil', 'vegetable'],
  'mangoes': ['mangos', 'raw'],
  'pistachios': ['nuts', 'pistachio', 'raw'],
  'beetroot': ['beets', 'raw'],
  'capsicum': ['peppers', 'sweet', 'red', 'raw'],
  'sardines': ['fish', 'sardine', 'atlantic', 'canned'],
  'aged cheeses': ['cheese', 'parmesan'],
  'hard aged cheeses': ['cheese', 'parmesan'],
  'goat or sheep dairy': ['milk', 'goat'],
  'goji berry powder': ['goji', 'berries', 'dried'],
  'goji berries': ['goji', 'berries', 'dried'],
  'homemade millet sourdough': ['bread', 'whole', 'wheat'],
  'babaganoush (fresh local)': ['eggplant', 'raw'],
  'salmon': ['fish', 'salmon', 'atlantic', 'raw'],
  'mackerel': ['fish', 'mackerel', 'atlantic', 'raw'],
  'basa fish': ['fish', 'catfish', 'channel', 'raw'],
  'other fatty fish': ['fish', 'salmon', 'atlantic', 'raw'],
  'white fish': ['fish', 'cod', 'atlantic', 'raw'],
  'tofu and tofu skins': ['tofu', 'raw', 'firm'],
  'tempeh': ['tempeh'],
  'hummus (fresh olive oil based)': ['hummus'],
  'oats': ['oats'],
  'potatoes': ['potatoes', 'boiled', 'flesh'],
  'bananas': ['bananas', 'raw'],
  'black beans': ['beans', 'black', 'mature', 'boiled'],
  'black soybeans': ['soybeans', 'mature', 'boiled'],
  'chickpeas/kabuli chana': ['chickpeas', 'mature', 'boiled'],
  'black chickpeas/kala chana': ['chickpeas', 'mature', 'boiled'],
  'lentils whole green (green mung)': ['lentils', 'mature', 'boiled'],
  'lentils red (masoor dal)': ['lentils', 'mature', 'boiled'],
  'split yellow peas (arhar dal)': ['pigeon', 'peas', 'mature', 'boiled'],
  'split yellow mung (moong dal)': ['mung', 'beans', 'mature', 'boiled'],
  'urad dal black': ['beans', 'black', 'mature', 'boiled'],
  'urad dal white': ['beans', 'black', 'mature', 'boiled'],
  'black coffee': ['coffee', 'brewed', 'prepared', 'water'],
  'heavy cream': ['cream', 'fluid', 'heavy', 'whipping'],
  'coffee with cream': ['cream', 'fluid', 'heavy', 'whipping'],
  'full fat yoghurt (buffalo preferred)': ['yogurt', 'whole', 'plain'],
  'full fat buffalo milk yoghurt': ['yogurt', 'whole', 'plain'],
  'buffalo milk kefir': ['yogurt', 'whole', 'plain'],
  'buffalo milk yoghurt': ['yogurt', 'whole', 'plain'],
  'butter (local)': ['butter', 'salted'],
  'honey': ['honey'],
  'mushrooms (all varieties)': ['mushrooms', 'white', 'raw'],
  'pineapple': ['pineapple', 'raw'],
  'berries': ['strawberries', 'raw'],
  'green apple': ['apples', 'raw', 'with', 'skin'],
  'himalayan pink salt': ['salt', 'table'],
  'himalayan pink salt in morning water': ['salt', 'table'],
  // Status=no / allergens / groups / supplements — map to null-macro
  // row intentionally; importer skips these via SKIP_MACROS below.
};

/**
 * Canonicals that do NOT need USDA macro data. Allergens already marked
 * `no,ALLERGY` (Brazil nuts, tree nuts), status=no processed-food rows,
 * category groups ("all leafy greens"), supplements / tonics
 * (ashwagandha, moringa powder) that are not calorically significant.
 * The fuzzy matcher is catastrophically wrong on these and they carry
 * no macro meaning for a macro-target calculator.
 */
const SKIP_MACROS = new Set<string>([
  'alcohol',
  'all herbs and spices',
  'all leafy greens',
  'almonds',
  'any refined seed oils',
  'artificial sweeteners (sucralose/aspartame/acesulfame-k)',
  'aspartame',
  'aspartame / sucralose / acesulfame',
  'ashwagandha',
  'ashwagandha powder',
  'bee pollen granules',
  'brazil nuts',
  'commercial cow dairy',
  'commercial cow milk as primary drink',
  'commercial sauces',
  'commercial sauces with sugar or starch',
  'commercial sports drinks',
  'dark leafy greens',
  'flavored yoghurts with added sugar',
  'hazelnuts',
  'heavily processed meats with long additive lists',
  'heavily processed meats with long ingredient lists',
  'himalayan mint tea (ban silam)',
  'large amounts of straight milk',
  'low fat dairy anything',
  'macadamia',
  'meats in sugar-heavy marinades',
  'moringa leaf powder',
  'pistachios',
  'processed meats with fillers or sugars',
  'processed meats with sodium nitrate',
  'refined sugar',
  'refined sugar and anything containing it',
  'refined white sugar',
  'seed oils in cooking',
  'sucralose',
  'turmeric powder',
  'walnuts',
  'wheat and all gluten-containing grains',
  'whey protein',
  'water',
  'stevia',
  'monk fruit',
  'yak cheese',
]);

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
  // USDA description). Pass through the same stop-word + plural
  // filters as tokenize() so wantTokens and haveTokens line up.
  if (alias) {
    return [
      ...new Set(
        alias
          .map((t) => stripPlural(t.toLowerCase()))
          .filter((t) => t.length > 1 && !STOP_WORDS.has(t)),
      ),
    ];
  }
  return tokenize(canon);
}

/**
 * Score a USDA description against a canonical diet-food name.
 * Higher = better match. Simple token-overlap score weighted by
 * inverse description length (prefer specific, short USDA entries
 * over verbose prep-laden ones).
 */
/**
 * Tokens in a USDA description that indicate a derivative product
 * (processed, preserved, concentrated, sweetened, …) and should
 * penalise the match hard unless the canonical explicitly asks for it.
 * Without this, "bananas" matches "banana powder, dehydrated" and
 * ships 346 kcal/100g where fresh banana is 89.
 */
const PENALTY_TOKENS = new Set([
  'baby',
  'babyfood',
  'beverage',
  'beverages',
  'canned',
  'cereal',
  'cereals',
  'chip',
  'chips',
  'concentrate',
  'condensed',
  'dehydrated',
  'dessert',
  'dip',
  'dried',
  'drink',
  'extract',
  'fortified',
  'frozen',
  'juice',
  'margarine',
  'meal',
  'nectar',
  'oil',
  'oils',
  'powder',
  'powdered',
  'pudding',
  'pureed',
  'sauce',
  'shake',
  'smoothie',
  'soup',
  'spread',
  'stick',
  'sticks',
  'substitute',
  'sugar',
  'sweetened',
  'syrup',
  'topping',
  'toppings',
  'yogurt',
]);

function scoreMatch(canonical: string, description: string): number {
  const wantTokens = new Set(expandCanonical(canonical));
  if (wantTokens.size === 0) return 0;
  const haveTokens = tokenize(description);
  let overlap = 0;
  let penalty = 0;
  for (const t of haveTokens) {
    if (wantTokens.has(t)) overlap++;
    else if (PENALTY_TOKENS.has(t)) penalty++;
  }
  if (overlap === 0) return 0;
  // Coverage ratio of our tokens found in the description.
  const coverage = overlap / wantTokens.size;
  // Tie-breaker: prefer short descriptions (fewer irrelevant tokens).
  const brevity = 10 / (10 + haveTokens.length);
  // Each unwanted "processed" token costs 15 points. Enough to push
  // a banana-powder match below the threshold when fresh-banana is
  // also in the list.
  return coverage * 100 + brevity * 5 - penalty * 15;
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
  const skippedIntentionally: string[] = [];
  const MIN_CONFIDENCE = 70; // out of 105; tightened after catching dozens of bogus matches in the initial pass
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
    if (SKIP_MACROS.has(canon)) {
      skippedIntentionally.push(canon);
      continue;
    }
    // Hard-pinned fdc_id bypasses fuzzy matching entirely.
    const forcedId = FORCE_FDC[canon];
    let best: Match | null = null;
    if (forcedId) {
      const forcedFood = foods.find((f) => f.fdc_id === forcedId);
      if (!forcedFood) {
        console.warn(`FORCE_FDC target ${forcedId} missing for ${canon}`);
        unmatched.push(canon);
        continue;
      }
      best = { fdc_id: forcedFood.fdc_id, description: forcedFood.description, score: 999 };
    } else {
      best = bestMatch(canon, foods);
    }
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

  const unmatchedBody =
    unmatched.length === 0
      ? '# all diet_foods either matched or intentionally skipped\n'
      : `# ${unmatched.length} foods need manual fill (IFCT_2017 / Korean DB / approximation)\n` +
        unmatched.map((c) => `- ${c}`).join('\n') +
        '\n';
  const skippedBody =
    skippedIntentionally.length === 0
      ? ''
      : `\n# ${skippedIntentionally.length} foods intentionally skipped — allergens / status=no / groups / supplements (no macro meaning)\n` +
        skippedIntentionally.map((c) => `- ${c}`).join('\n') +
        '\n';
  fs.writeFileSync(UNMATCHED_PATH, unmatchedBody + skippedBody);
  console.log(
    `wrote ${output.length - 1} rows to food_nutrition.csv ` +
      `(${autoMatched} auto-matched, ${existing.size} preserved)`,
  );
  console.log(
    `${unmatched.length} unmatched + ${skippedIntentionally.length} intentionally skipped (see food_nutrition_unmatched.txt)`,
  );
}

main();

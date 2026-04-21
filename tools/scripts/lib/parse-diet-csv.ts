/**
 * CSV parsers for the diet-protocol seed.
 *
 * Extracted from the seeder so they can be unit-tested without running
 * the full seed pipeline. Pure functions — string in, rows out.
 */

export type FoodStatus = 'yes' | 'caution' | 'no';
export type SupplementTier = 'core' | 'food_sourced' | 'optional';
export type EvidenceGrade = 'A' | 'B' | 'C';
export type NepalSourcing = 'local' | 'import' | 'food' | 'mixed';
export type LifestyleCategory =
  | 'compression'
  | 'manual_therapy'
  | 'movement'
  | 'stress'
  | 'sleep'
  | 'other';
export type LifestyleFrequency = 'daily' | 'weekly' | 'as_needed';

export interface FoodRow {
  category: string;
  food: string;
  status: FoodStatus;
  notes: string;
}

export interface SupplementRow {
  slug: string;
  name: string;
  tier: SupplementTier;
  dose: string | null;
  rationale: string | null;
  evidence_grade: EvidenceGrade | null;
  food_equivalent: string | null;
  nepal_sourcing: NepalSourcing | null;
  notes: string | null;
  sort_order: number;
}

export type NutritionSource =
  | 'USDA_SR'
  | 'USDA_Foundation'
  | 'USDA_FNDDS'
  | 'IFCT_2017'
  | 'manual';

export interface NutritionRow {
  canonical_name: string;
  serving_g: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number | null;
  source: NutritionSource;
  source_id: string | null;
}

export interface LifestyleRow {
  slug: string;
  name: string;
  category: LifestyleCategory;
  frequency: LifestyleFrequency;
  description: string | null;
  rationale: string | null;
  sort_order: number;
}

export function parseFoodCsv(text: string): FoodRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const [header, ...rest] = lines;
  if (!/^category,food,status,notes/i.test(header)) {
    throw new Error(`Unexpected food CSV header: ${header}`);
  }
  return rest.map((line, i) => {
    const parts = line.split(',');
    if (parts.length < 3) throw new Error(`Malformed row ${i + 2}: ${line}`);
    const [category, food, status, ...noteParts] = parts;
    const s = status.trim().toLowerCase();
    if (s !== 'yes' && s !== 'caution' && s !== 'no') {
      throw new Error(`Row ${i + 2}: invalid status "${status}"`);
    }
    return {
      category: category.trim(),
      food: food.trim(),
      status: s,
      notes: noteParts.join(',').trim(),
    };
  });
}

/**
 * Minimal CSV parser that honours double-quoted fields (commas inside
 * quotes preserved). Good enough for our hand-authored supplement /
 * lifestyle CSVs; do NOT use for arbitrary third-party CSV.
 */
export function parseQuotedCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const SUPP_HEADER = [
  'slug',
  'name',
  'tier',
  'dose',
  'rationale',
  'evidence_grade',
  'food_equivalent',
  'nepal_sourcing',
  'notes',
  'sort_order',
] as const;

const LIFESTYLE_HEADER = [
  'slug',
  'name',
  'category',
  'frequency',
  'description',
  'rationale',
  'sort_order',
] as const;

const LIFESTYLE_CATEGORIES = new Set<LifestyleCategory>([
  'compression',
  'manual_therapy',
  'movement',
  'stress',
  'sleep',
  'other',
]);
const LIFESTYLE_FREQUENCIES = new Set<LifestyleFrequency>([
  'daily',
  'weekly',
  'as_needed',
]);

export function parseSupplementCsv(text: string): SupplementRow[] {
  const rows = parseQuotedCsv(text).filter((r) => r.some((c) => c.length > 0));
  const [header, ...rest] = rows;
  for (let i = 0; i < SUPP_HEADER.length; i++) {
    if ((header[i] ?? '').trim() !== SUPP_HEADER[i]) {
      throw new Error(
        `Unexpected supplement header at col ${i}: got "${header[i]}" expected "${SUPP_HEADER[i]}"`,
      );
    }
  }
  return rest.map((cols, i) => {
    const [
      slug,
      name,
      tier,
      dose,
      rationale,
      grade,
      foodEq,
      sourcing,
      notes,
      sortRaw,
    ] = cols;
    const tierT = (tier ?? '').trim();
    if (tierT !== 'core' && tierT !== 'food_sourced' && tierT !== 'optional') {
      throw new Error(`Row ${i + 2}: invalid tier "${tier}"`);
    }
    const gradeT = (grade ?? '').trim().toUpperCase();
    const gradeVal: EvidenceGrade | null =
      gradeT === 'A' || gradeT === 'B' || gradeT === 'C' ? gradeT : null;
    const sourcingT = (sourcing ?? '').trim();
    const sourcingVal: NepalSourcing | null =
      sourcingT === 'local' ||
      sourcingT === 'import' ||
      sourcingT === 'food' ||
      sourcingT === 'mixed'
        ? sourcingT
        : null;
    const sortVal = Number.parseInt((sortRaw ?? '0').trim(), 10);
    return {
      slug: slug.trim(),
      name: name.trim(),
      tier: tierT,
      dose: dose?.trim() || null,
      rationale: rationale?.trim() || null,
      evidence_grade: gradeVal,
      food_equivalent: foodEq?.trim() || null,
      nepal_sourcing: sourcingVal,
      notes: notes?.trim() || null,
      sort_order: Number.isFinite(sortVal) ? sortVal : 0,
    };
  });
}

export function parseLifestyleCsv(text: string): LifestyleRow[] {
  const rows = parseQuotedCsv(text).filter((r) => r.some((c) => c.length > 0));
  const [header, ...rest] = rows;
  for (let i = 0; i < LIFESTYLE_HEADER.length; i++) {
    if ((header[i] ?? '').trim() !== LIFESTYLE_HEADER[i]) {
      throw new Error(
        `Unexpected lifestyle header at col ${i}: got "${header[i]}" expected "${LIFESTYLE_HEADER[i]}"`,
      );
    }
  }
  return rest.map((cols, i) => {
    const [slug, name, category, frequency, description, rationale, sortRaw] =
      cols;
    const categoryT = (category ?? '').trim() as LifestyleCategory;
    if (!LIFESTYLE_CATEGORIES.has(categoryT)) {
      throw new Error(`Row ${i + 2}: invalid lifestyle category "${category}"`);
    }
    const freqT = (frequency ?? '').trim() as LifestyleFrequency;
    if (!LIFESTYLE_FREQUENCIES.has(freqT)) {
      throw new Error(
        `Row ${i + 2}: invalid lifestyle frequency "${frequency}"`,
      );
    }
    const sortVal = Number.parseInt((sortRaw ?? '0').trim(), 10);
    return {
      slug: slug.trim(),
      name: name.trim(),
      category: categoryT,
      frequency: freqT,
      description: description?.trim() || null,
      rationale: rationale?.trim() || null,
      sort_order: Number.isFinite(sortVal) ? sortVal : 0,
    };
  });
}

const NUTRITION_HEADER_REQUIRED = [
  'canonical_name',
  'serving_g',
  'kcal',
  'protein_g',
  'fat_g',
  'carb_g',
  'fiber_g',
  'source',
  'source_id',
] as const;

const NUTRITION_SOURCES = new Set<NutritionSource>([
  'USDA_SR',
  'USDA_Foundation',
  'USDA_FNDDS',
  'IFCT_2017',
  'manual',
]);

function parseNumber(s: string | undefined, fallback: number | null = null): number | null {
  if (s === undefined) return fallback;
  const trimmed = s.trim();
  if (trimmed.length === 0) return fallback;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parses tools/data/food_nutrition.csv. Header columns after
 * `source_id` (e.g. `confidence`, `usda_description`) are tolerated
 * and ignored — the importer adds them for human review.
 */
export function parseNutritionCsv(text: string): NutritionRow[] {
  const rows = parseQuotedCsv(text).filter((r) => r.some((c) => c.length > 0));
  const [header, ...rest] = rows;
  for (let i = 0; i < NUTRITION_HEADER_REQUIRED.length; i++) {
    if ((header[i] ?? '').trim() !== NUTRITION_HEADER_REQUIRED[i]) {
      throw new Error(
        `Unexpected nutrition header at col ${i}: got "${header[i]}" expected "${NUTRITION_HEADER_REQUIRED[i]}"`,
      );
    }
  }
  return rest.map((cols, i) => {
    const canonical_name = (cols[0] ?? '').trim();
    if (!canonical_name) {
      throw new Error(`Row ${i + 2}: empty canonical_name`);
    }
    const serving = parseNumber(cols[1], 100);
    const kcal = parseNumber(cols[2]);
    const protein_g = parseNumber(cols[3]);
    const fat_g = parseNumber(cols[4]);
    const carb_g = parseNumber(cols[5]);
    const fiber_g = parseNumber(cols[6]);
    const sourceT = (cols[7] ?? '').trim() as NutritionSource;
    if (!NUTRITION_SOURCES.has(sourceT)) {
      throw new Error(`Row ${i + 2}: invalid source "${cols[7]}"`);
    }
    if (kcal === null || protein_g === null || fat_g === null || carb_g === null) {
      throw new Error(`Row ${i + 2}: kcal/protein/fat/carb must be numeric`);
    }
    const sourceIdRaw = (cols[8] ?? '').trim();
    return {
      canonical_name,
      serving_g: serving ?? 100,
      kcal,
      protein_g,
      fat_g,
      carb_g,
      fiber_g,
      source: sourceT,
      source_id: sourceIdRaw.length > 0 ? sourceIdRaw : null,
    };
  });
}

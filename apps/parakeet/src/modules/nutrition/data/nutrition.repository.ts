// @spec docs/features/nutrition/spec-data-layer.md
import { typedSupabase } from '@platform/supabase';

import type {
  DietFood,
  DietLifestyle,
  DietProtocol,
  DietSupplement,
  FoodNutritionRow,
  ProtocolBundle,
} from '../model/types';

export async function fetchProtocols(): Promise<DietProtocol[]> {
  const { data, error } = await typedSupabase
    .from('diet_protocols')
    .select('id, slug, name, description_md')
    .order('slug');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    descriptionMd: r.description_md,
  }));
}

export async function fetchProtocolBundle(
  slug: string,
): Promise<ProtocolBundle | null> {
  const { data: protoRow, error: pErr } = await typedSupabase
    .from('diet_protocols')
    .select('id, slug, name, description_md')
    .eq('slug', slug)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!protoRow) return null;

  const [foodsRes, suppsRes, lifestyleRes] = await Promise.all([
    typedSupabase
      .from('diet_protocol_foods')
      .select(
        'status, notes, diet_foods(id, display_name, category)',
      )
      .eq('protocol_id', protoRow.id),
    typedSupabase
      .from('diet_supplements')
      .select(
        'id, slug, name, tier, dose, rationale, evidence_grade, food_equivalent, nepal_sourcing, notes, sort_order',
      )
      .eq('protocol_id', protoRow.id)
      .order('sort_order'),
    typedSupabase
      .from('diet_lifestyle')
      .select(
        'id, slug, name, category, frequency, description, rationale, sort_order',
      )
      .eq('protocol_id', protoRow.id)
      .order('sort_order'),
  ]);

  if (foodsRes.error) throw foodsRes.error;
  if (suppsRes.error) throw suppsRes.error;
  if (lifestyleRes.error) throw lifestyleRes.error;

  const foods: DietFood[] = (foodsRes.data ?? [])
    .map((r) => {
      const f = r.diet_foods;
      if (!f) return null;
      return {
        id: f.id,
        displayName: f.display_name,
        category: f.category,
        status: r.status as DietFood['status'],
        notes: r.notes,
      } satisfies DietFood;
    })
    .filter((f): f is DietFood => f !== null);

  const supplements: DietSupplement[] = (suppsRes.data ?? []).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    tier: s.tier as DietSupplement['tier'],
    dose: s.dose,
    rationale: s.rationale,
    evidenceGrade: s.evidence_grade as DietSupplement['evidenceGrade'],
    foodEquivalent: s.food_equivalent,
    nepalSourcing: s.nepal_sourcing as DietSupplement['nepalSourcing'],
    notes: s.notes,
    sortOrder: s.sort_order,
  }));

  const lifestyle: DietLifestyle[] = (lifestyleRes.data ?? []).map((l) => ({
    id: l.id,
    slug: l.slug,
    name: l.name,
    category: l.category as DietLifestyle['category'],
    frequency: l.frequency as DietLifestyle['frequency'],
    description: l.description,
    rationale: l.rationale,
    sortOrder: l.sort_order,
  }));

  return {
    protocol: {
      id: protoRow.id,
      slug: protoRow.slug,
      name: protoRow.name,
      descriptionMd: protoRow.description_md,
    },
    foods,
    supplements,
    lifestyle,
  };
}

export async function fetchAllFoodNutrition(): Promise<FoodNutritionRow[]> {
  const { data, error } = await typedSupabase
    .from('diet_food_nutrition')
    .select('food_id, serving_g, kcal, protein_g, fat_g, carb_g, fiber_g, diet_foods(display_name, category)')
    .order('food_id');
  if (error) throw error;
  return (data ?? [])
    .map((r) => {
      const food = r.diet_foods;
      if (!food) return null;
      return {
        foodId: r.food_id,
        displayName: food.display_name,
        category: food.category,
        servingG: r.serving_g,
        kcal: r.kcal,
        proteinG: r.protein_g,
        fatG: r.fat_g,
        carbG: r.carb_g,
        fiberG: r.fiber_g,
      } satisfies FoodNutritionRow;
    })
    .filter((r): r is FoodNutritionRow => r !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

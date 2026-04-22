export type FoodStatus = 'yes' | 'caution' | 'no';
export type SupplementTier = 'core' | 'food_sourced' | 'optional';
export type EvidenceGrade = 'A' | 'B' | 'C';
export type NepalSourcing = 'local' | 'import' | 'food' | 'mixed';

export interface DietProtocol {
  id: string;
  slug: string;
  name: string;
  descriptionMd: string | null;
}

export interface DietFood {
  id: string;
  displayName: string;
  category: string;
  status: FoodStatus;
  notes: string | null;
}

export interface DietSupplement {
  id: string;
  slug: string;
  name: string;
  tier: SupplementTier;
  dose: string | null;
  rationale: string | null;
  evidenceGrade: EvidenceGrade | null;
  foodEquivalent: string | null;
  nepalSourcing: NepalSourcing | null;
  notes: string | null;
  sortOrder: number;
}

export type LifestyleCategory =
  | 'compression'
  | 'manual_therapy'
  | 'movement'
  | 'stress'
  | 'sleep'
  | 'other';

export type LifestyleFrequency = 'daily' | 'weekly' | 'as_needed';

export interface DietLifestyle {
  id: string;
  slug: string;
  name: string;
  category: LifestyleCategory;
  frequency: LifestyleFrequency;
  description: string | null;
  rationale: string | null;
  sortOrder: number;
}

export interface FoodNutritionRow {
  foodId: string;
  displayName: string;
  category: string;
  servingG: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  fiberG: number | null;
}

export interface ProtocolBundle {
  protocol: DietProtocol;
  foods: DietFood[];
  supplements: DietSupplement[];
  lifestyle: DietLifestyle[];
}

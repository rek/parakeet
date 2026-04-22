export { NutritionScreen } from './ui/NutritionScreen';
export { MacroTargetsCard } from './ui/MacroTargetsCard';
export { nutritionQueries } from './data/nutrition.queries';
export { useProtocols, useProtocolBundle, useFoodNutrition } from './hooks/useNutrition';
export { useMacroTargets } from './hooks/useMacroTargets';
export { computeMacroTargets, MacroTargetDefaults } from './lib/macro-targets';
export type {
  ActivityLevel as NutritionActivityLevel,
  BiologicalSex as NutritionBiologicalSex,
  DietProtocolSlug,
  Goal as NutritionGoal,
  MacroTarget,
  MacroTargetInput,
} from './lib/macro-targets';
export type {
  DietFood,
  DietLifestyle,
  DietProtocol,
  DietSupplement,
  EvidenceGrade,
  FoodNutritionRow,
  FoodStatus,
  LifestyleCategory,
  LifestyleFrequency,
  NepalSourcing,
  ProtocolBundle,
  SupplementTier,
} from './model/types';

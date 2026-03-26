const PLATE_SIZES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
export type PlateKg = (typeof PLATE_SIZES_KG)[number];

/** Standard IWF plate colors by weight (kg). */
export const PLATE_COLORS: Record<PlateKg, string> = {
  25: '#DC2626',
  20: '#1D4ED8',
  15: '#FACC15',
  10: '#15803D',
  5: '#27272A',
  2.5: '#F87171',
  1.25: '#A1A1AA',
};

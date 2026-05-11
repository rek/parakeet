// Re-export the engine's plate catalogue so the app and the engine share a
// single source of truth (the engine version is the canonical one — it backs
// `plateIncrementKg` used by JIT generation). The standalone copy that used
// to live here drifted from the engine's exports as soon as the engine
// promoted `PLATE_SIZES_KG` to public API (commit ca55087).
export {
  PLATE_COLORS,
  PLATE_SIZES_KG,
  calculatePlates,
  type PlateKg,
  type PlateResult,
} from '@parakeet/training-engine';

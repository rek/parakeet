// @spec docs/features/programs/spec-generation-api.md
// Re-exports of training-engine values used by screens that consume the
// program module's public API. Screens must import from @modules/program,
// not directly from @parakeet/training-engine.
export {
  calculateSets,
  DEFAULT_AUXILIARY_POOLS,
  DEFAULT_TRAINING_DAYS,
  generateProgram,
  getAuxiliariesForBlock,
  nextDateForWeekday,
} from '@parakeet/training-engine';

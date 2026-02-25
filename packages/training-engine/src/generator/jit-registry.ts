import type { JITGeneratorStrategy, JITStrategyName } from './jit-strategy'
import { FormulaJITGenerator } from './formula-jit-generator'
import { LLMJITGenerator } from './llm-jit-generator'

export function getJITGenerator(
  strategy: JITStrategyName,
  isOnline: boolean,
): JITGeneratorStrategy {
  switch (strategy) {
    case 'llm':
      return new LLMJITGenerator()
    case 'formula':
      return new FormulaJITGenerator()
    case 'hybrid':
      throw new Error('HybridJITGenerator not yet implemented (v2)')
    case 'auto':
      return isOnline ? new LLMJITGenerator() : new FormulaJITGenerator()
  }
}

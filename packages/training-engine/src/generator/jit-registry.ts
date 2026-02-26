import type { JITGeneratorStrategy, JITStrategyName } from './jit-strategy'
import { FormulaJITGenerator } from './formula-jit-generator'
import { LLMJITGenerator } from './llm-jit-generator'
import { HybridJITGenerator } from './hybrid-jit-generator'
import type { ComparisonLogger } from './hybrid-jit-generator'

export function getJITGenerator(
  strategy: JITStrategyName,
  isOnline: boolean,
  comparisonLogger?: ComparisonLogger,
): JITGeneratorStrategy {
  switch (strategy) {
    case 'llm':
      return new LLMJITGenerator()
    case 'formula':
      return new FormulaJITGenerator()
    case 'hybrid':
      return new HybridJITGenerator(
        new FormulaJITGenerator(),
        new LLMJITGenerator(),
        comparisonLogger,
      )
    case 'auto':
      return isOnline ? new LLMJITGenerator() : new FormulaJITGenerator()
  }
}

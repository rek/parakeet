import type { JITGeneratorStrategy } from './jit-strategy'
import type { JITInput, JITOutput } from './jit-session-generator'
import { FormulaJITGenerator } from './formula-jit-generator'
import { LLMJITGenerator } from './llm-jit-generator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DivergenceResult {
  /** |llmWeight - formulaWeight| / formulaWeight */
  weightPct: number
  /** llmSets - formulaSets (signed) */
  setDelta: number
  /** First line of LLM rationale — context summary for developer display */
  rpeContextSummary: string
}

/** Optional callback injected at construction time for fire-and-forget logging.
 *  Kept as a callback to avoid importing Supabase into the engine package. */
export type ComparisonLogger = (
  input: JITInput,
  formulaOutput: JITOutput,
  llmOutput: JITOutput,
  divergence: DivergenceResult,
) => void

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function computeDivergence(formula: JITOutput, llm: JITOutput): DivergenceResult {
  const formulaWeight = formula.mainLiftSets[0]?.weight_kg ?? 0
  const llmWeight = llm.mainLiftSets[0]?.weight_kg ?? 0
  return {
    weightPct: formulaWeight > 0 ? Math.abs(llmWeight - formulaWeight) / formulaWeight : 0,
    setDelta: llm.mainLiftSets.length - formula.mainLiftSets.length,
    rpeContextSummary: llm.rationale?.[0] ?? '',
  }
}

// ---------------------------------------------------------------------------
// HybridJITGenerator
// ---------------------------------------------------------------------------

export class HybridJITGenerator implements JITGeneratorStrategy {
  readonly name = 'hybrid' as const
  readonly description = 'Runs formula and LLM in parallel; compares outputs'

  constructor(
    private formula: FormulaJITGenerator = new FormulaJITGenerator(),
    private llm: LLMJITGenerator = new LLMJITGenerator(),
    private logger?: ComparisonLogger,
  ) {}

  async generate(input: JITInput): Promise<JITOutput> {
    const [formulaResult, llmResult] = await Promise.allSettled([
      this.formula.generate(input),
      this.llm.generate(input),
    ])

    const formulaOutput = formulaResult.status === 'fulfilled' ? formulaResult.value : null
    const llmOutput = llmResult.status === 'fulfilled' ? llmResult.value : null

    // Formula should never fail (deterministic, local) — propagate if it does
    if (!formulaOutput) {
      throw (formulaResult as PromiseRejectedResult).reason
    }

    // LLM failed → fall back to formula output
    if (!llmOutput) {
      return { ...formulaOutput, jit_strategy: 'formula_fallback' }
    }

    const divergence = computeDivergence(formulaOutput, llmOutput)

    // Fire-and-forget comparison log — must not block JIT output
    if (this.logger) {
      try {
        this.logger(input, formulaOutput, llmOutput, divergence)
      } catch {
        // logging errors are silently swallowed
      }
    }

    if (divergence.weightPct <= 0.1 && divergence.setDelta === 0) {
      // Agree within 10% weight + same set count → use LLM (better rationale)
      return {
        ...llmOutput,
        jit_strategy: 'llm',
        comparisonData: {
          divergence,
          formulaOutput,
          shouldSurfaceToUser: false,
        },
      }
    }

    // Diverge → return LLM output and attach comparison for optional UI display
    return {
      ...llmOutput,
      jit_strategy: 'llm',
      comparisonData: {
        divergence,
        formulaOutput,
        shouldSurfaceToUser: divergence.weightPct > 0.15 || divergence.setDelta !== 0,
      },
    }
  }
}

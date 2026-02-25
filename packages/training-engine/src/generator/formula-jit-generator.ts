import type { JITGeneratorStrategy } from './jit-strategy'
import type { JITInput, JITOutput } from './jit-session-generator'
import { generateJITSession } from './jit-session-generator'

export class FormulaJITGenerator implements JITGeneratorStrategy {
  readonly name = 'formula' as const
  readonly description = 'Rule-based deterministic generator — works offline'

  generate(input: JITInput): Promise<JITOutput> {
    return Promise.resolve(generateJITSession(input))
  }
}

import type { JITInput, JITOutput } from './jit-session-generator'

export interface JITGeneratorStrategy {
  readonly name: 'formula' | 'llm' | 'hybrid'
  readonly description: string
  generate(input: JITInput): Promise<JITOutput>
}

export type JITStrategyName = 'auto' | 'formula' | 'llm' | 'hybrid'

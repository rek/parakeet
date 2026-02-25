import { createAnthropic } from '@ai-sdk/anthropic'

const anthropic = createAnthropic({
  apiKey: process.env['EXPO_PUBLIC_ANTHROPIC_API_KEY'],
})

// Fast, cheap — used for JIT session generation (5s timeout)
export const JIT_MODEL = anthropic('claude-haiku-4-5')

// Deep reasoning — used for cycle review (async, no timeout)
export const CYCLE_REVIEW_MODEL = anthropic('claude-sonnet-4-6')

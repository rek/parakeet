import { generateObject } from 'ai'
import { CycleReviewSchema } from '@parakeet/shared-types'
import type { CycleReview } from '@parakeet/shared-types'
import { CYCLE_REVIEW_MODEL } from '../ai/models'
import { CYCLE_REVIEW_SYSTEM_PROMPT } from '../ai/prompts'
import type { CycleReport } from './assemble-cycle-report'

export type { CycleReview }

export async function generateCycleReview(
  cycleReport: CycleReport,
  previousCycleSummaries: string[],
): Promise<CycleReview> {
  const { object } = await generateObject({
    model: CYCLE_REVIEW_MODEL,
    schema: CycleReviewSchema,
    system: CYCLE_REVIEW_SYSTEM_PROMPT,
    prompt: JSON.stringify({ cycleReport, previousCycleSummaries }),
  })
  return object
}

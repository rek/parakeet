// @spec docs/features/disruptions/spec-unprogrammed.md
import type { DisruptionType } from '@parakeet/shared-types';

/** Per-type shelf life (days) for open-ended ("ongoing") disruptions before
 *  the today screen should prompt the lifter to confirm whether the issue is
 *  still active. Bundle C wires the UI; this module provides the constants
 *  and the service-layer extension method (finding #7).
 *
 *  Injury heals slowly so we wait 14 days before nudging. Acute things like
 *  illness or fatigue should clear in a week. Travel and equipment
 *  disruptions are typically planned (work trip, broken rack) and can last
 *  longer without warranting a prompt. */
export const DISRUPTION_SHELF_LIFE_DAYS: Record<DisruptionType, number> = {
  injury: 14,
  illness: 7,
  fatigue: 7,
  travel: 30,
  equipment_unavailable: 30,
  unprogrammed_event: 7,
  other: 14,
};

/** Days a snooze adds before the prompt re-fires (finding #7). */
export const DISRUPTION_SNOOZE_DAYS = 1;

/** Fallback shelf life when a disruption_type isn't in the lookup table —
 *  for forward-compat with new types added by migration without a docs/lib
 *  bump. The 7-day default errs on the side of prompting sooner. */
export const DEFAULT_DISRUPTION_SHELF_LIFE_DAYS = 7;

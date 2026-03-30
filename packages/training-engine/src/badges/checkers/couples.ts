import type { BadgeCheckContext, BadgeId } from '../badge-types';

/**
 * Power Couple: both the user and at least one accepted gym partner
 * completed a session on the same calendar day.
 */
export function checkCouplesBadges({
  partnerCompletedToday,
}: Pick<BadgeCheckContext, 'partnerCompletedToday'>) {
  const earned: BadgeId[] = [];

  if (partnerCompletedToday) {
    earned.push('power_couple');
  }

  return earned;
}

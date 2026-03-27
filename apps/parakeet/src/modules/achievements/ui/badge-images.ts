import type { ImageSourcePropType } from 'react-native';

import type { BadgeId } from '../lib/engine-adapter';

/**
 * Static require map for badge images.
 * Partial so that missing images fall back to emoji in BadgeIcon.
 */
export const BADGE_IMAGES: Partial<Record<BadgeId, ImageSourcePropType>> = {
  // Consistency
  dawn_patrol: require('../../../../assets/images/badges/dawn_patrol.png'),
  night_owl: require('../../../../assets/images/badges/night_owl.png'),
  iron_monk: require('../../../../assets/images/badges/iron_monk.png'),
  sunday_scaries_cure: require('../../../../assets/images/badges/sunday_scaries_cure.png'),
  year_365: require('../../../../assets/images/badges/year_365.png'),
  perfect_week: require('../../../../assets/images/badges/perfect_week.png'),
  leg_day_loyalist: require('../../../../assets/images/badges/leg_day_loyalist.png'),

  // Performance
  gravity_meet_your_match: require('../../../../assets/images/badges/gravity_meet_your_match.png'),
  sir_isaacs_worst_nightmare: require('../../../../assets/images/badges/sir_isaacs_worst_nightmare.png'),
  the_tonne: require('../../../../assets/images/badges/the_tonne.png'),
  round_number_enjoyer: require('../../../../assets/images/badges/round_number_enjoyer.png'),
  triple_threat: require('../../../../assets/images/badges/triple_threat.png'),
  technically_a_pr: require('../../../../assets/images/badges/technically_a_pr.png'),
  the_centurion: require('../../../../assets/images/badges/the_centurion.png'),

  // Situational
  comeback_kid: require('../../../../assets/images/badges/comeback_kid.png'),
  didnt_want_to_be_here: require('../../../../assets/images/badges/didnt_want_to_be_here.png'),
  volume_goblin: require('../../../../assets/images/badges/volume_goblin.png'),
  one_more_rep: require('../../../../assets/images/badges/one_more_rep.png'),
  plate_math_phd: require('../../../../assets/images/badges/plate_math_phd.png'),
  sandbagger: require('../../../../assets/images/badges/sandbagger.png'),
  bad_day_survivor: require('../../../../assets/images/badges/bad_day_survivor.png'),
  the_grinder: require('../../../../assets/images/badges/the_grinder.png'),
  tactical_retreat: require('../../../../assets/images/badges/tactical_retreat.png'),

  // Lift Identity
  bench_bro: require('../../../../assets/images/badges/bench_bro.png'),
  the_specialist: require('../../../../assets/images/badges/the_specialist.png'),
  equal_opportunity_lifter: require('../../../../assets/images/badges/equal_opportunity_lifter.png'),

  // Rest Pacing
  impatient: require('../../../../assets/images/badges/impatient.png'),
  zen_master: require('../../../../assets/images/badges/zen_master.png'),
  social_hour: require('../../../../assets/images/badges/social_hour.png'),

  // RPE Effort
  rpe_whisperer: require('../../../../assets/images/badges/rpe_whisperer.png'),
  sandbag_detected: require('../../../../assets/images/badges/sandbag_detected.png'),
  send_it: require('../../../../assets/images/badges/send_it.png'),

  // Program Loyalty
  old_faithful: require('../../../../assets/images/badges/old_faithful.png'),
  shiny_object_syndrome: require('../../../../assets/images/badges/shiny_object_syndrome.png'),
  deload_denier: require('../../../../assets/images/badges/deload_denier.png'),

  // Volume Rep
  rep_machine: require('../../../../assets/images/badges/rep_machine.png'),
  singles_club: require('../../../../assets/images/badges/singles_club.png'),
  jack_of_all_lifts: require('../../../../assets/images/badges/jack_of_all_lifts.png'),

  // Session Milestones
  first_blood: require('../../../../assets/images/badges/first_blood.png'),
  parakeet_og: require('../../../../assets/images/badges/parakeet_og.png'),
  century_club: require('../../../../assets/images/badges/century_club.png'),
  five_hundred_club: require('../../../../assets/images/badges/five_hundred_club.png'),

  // Wild Rare
  ghost_protocol: require('../../../../assets/images/badges/ghost_protocol.png'),
  marathon_lifter: require('../../../../assets/images/badges/marathon_lifter.png'),
  the_streak_breaker: require('../../../../assets/images/badges/the_streak_breaker.png'),

  // Couples
  power_couple: require('../../../../assets/images/badges/power_couple.png'),
};

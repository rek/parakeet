import { useMemo } from 'react';

import { useProfile } from '@modules/profile';

import {
  computeMacroTargets,
  type BiologicalSex,
  type DietProtocolSlug,
  type MacroTarget,
} from '../lib/macro-targets';

export interface MacroTargetsResult {
  target: MacroTarget | null;
  /** Profile fields that are needed but not yet set. */
  missing: Array<'bodyweight_kg' | 'biological_sex'>;
  /** True while profile is loading. Use to hide the card. */
  isLoading: boolean;
}

/**
 * Compute the lifter's daily macro targets for a given protocol.
 *
 * Minimum inputs required: bodyweight_kg + biological_sex. Without
 * these the hook returns `target: null` and lists them in `missing`
 * so the UI can prompt to finish the profile.
 *
 * Height / lean-mass / activity / goal are *not yet* in the Profile
 * service. Once the profile repository and UI learn those columns,
 * they should be threaded into the `computeMacroTargets` call here.
 * The macro-targets fn already handles their absence with a
 * low-confidence bodyweight-only fallback.
 */
export function useMacroTargets(
  protocol: DietProtocolSlug,
  options?: { training_day?: boolean },
): MacroTargetsResult {
  const profileQuery = useProfile();
  const profile = profileQuery.data ?? null;

  return useMemo(() => {
    if (profileQuery.isLoading) {
      return { target: null, missing: [], isLoading: true };
    }
    const missing: MacroTargetsResult['missing'] = [];
    if (!profile?.bodyweight_kg) missing.push('bodyweight_kg');
    if (!profile?.biological_sex) missing.push('biological_sex');
    if (missing.length > 0 || !profile) {
      return { target: null, missing, isLoading: false };
    }

    const age_years = computeAgeYears(profile.date_of_birth);
    const target = computeMacroTargets({
      bodyweight_kg: profile.bodyweight_kg!,
      biological_sex: profile.biological_sex as BiologicalSex,
      age_years,
      height_cm: profile.height_cm,
      lean_mass_kg: profile.lean_mass_kg,
      activity_level: profile.activity_level,
      goal: profile.goal,
      protocol,
      training_day: options?.training_day ?? false,
    });
    return { target, missing: [], isLoading: false };
  }, [profile, profileQuery.isLoading, protocol, options?.training_day]);
}

function computeAgeYears(dob: string | null): number | null {
  if (!dob) return null;
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const m = now.getMonth() - parsed.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < parsed.getDate())) age--;
  return age;
}

// @spec docs/features/lipedema-tracking/spec-data-layer.md
import type { UpsertInput } from '../data/lipedema-tracking.repository';
import { cmStringToMm, mmToCmString, parseZeroToTen } from '../lib/units';
import type { LipedemaMeasurement, MeasurementDraft } from '../model/types';

export function emptyDraft(today: string): MeasurementDraft {
  return {
    recordedDate: today,
    thighMidL: '',
    thighMidR: '',
    calfMaxL: '',
    calfMaxR: '',
    ankleL: '',
    ankleR: '',
    upperArmL: '',
    upperArmR: '',
    wristL: '',
    wristR: '',
    pain: '',
    swelling: '',
    notes: '',
  };
}

export function measurementToDraft(m: LipedemaMeasurement): MeasurementDraft {
  return {
    recordedDate: m.recordedDate,
    thighMidL: mmToCmString(m.thighMidLMm),
    thighMidR: mmToCmString(m.thighMidRMm),
    calfMaxL: mmToCmString(m.calfMaxLMm),
    calfMaxR: mmToCmString(m.calfMaxRMm),
    ankleL: mmToCmString(m.ankleLMm),
    ankleR: mmToCmString(m.ankleRMm),
    upperArmL: mmToCmString(m.upperArmLMm),
    upperArmR: mmToCmString(m.upperArmRMm),
    wristL: mmToCmString(m.wristLMm),
    wristR: mmToCmString(m.wristRMm),
    pain: m.painScore == null ? '' : m.painScore.toString(),
    swelling: m.swellingScore == null ? '' : m.swellingScore.toString(),
    notes: m.notes ?? '',
  };
}

export function draftToUpsert(d: MeasurementDraft): UpsertInput {
  return {
    recorded_date: d.recordedDate,
    thigh_mid_l_mm: cmStringToMm(d.thighMidL),
    thigh_mid_r_mm: cmStringToMm(d.thighMidR),
    calf_max_l_mm: cmStringToMm(d.calfMaxL),
    calf_max_r_mm: cmStringToMm(d.calfMaxR),
    ankle_l_mm: cmStringToMm(d.ankleL),
    ankle_r_mm: cmStringToMm(d.ankleR),
    upper_arm_l_mm: cmStringToMm(d.upperArmL),
    upper_arm_r_mm: cmStringToMm(d.upperArmR),
    wrist_l_mm: cmStringToMm(d.wristL),
    wrist_r_mm: cmStringToMm(d.wristR),
    pain_0_10: parseZeroToTen(d.pain),
    swelling_0_10: parseZeroToTen(d.swelling),
    notes: d.notes.trim() || null,
  };
}

export function draftIsEmpty(d: MeasurementDraft): boolean {
  const u = draftToUpsert(d);
  return (
    u.thigh_mid_l_mm == null &&
    u.thigh_mid_r_mm == null &&
    u.calf_max_l_mm == null &&
    u.calf_max_r_mm == null &&
    u.ankle_l_mm == null &&
    u.ankle_r_mm == null &&
    u.upper_arm_l_mm == null &&
    u.upper_arm_r_mm == null &&
    u.wrist_l_mm == null &&
    u.wrist_r_mm == null &&
    u.pain_0_10 == null &&
    u.swelling_0_10 == null &&
    !u.notes
  );
}

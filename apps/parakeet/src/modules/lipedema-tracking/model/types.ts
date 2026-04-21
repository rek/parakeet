export type Limb =
  | 'thigh_mid'
  | 'calf_max'
  | 'ankle'
  | 'upper_arm'
  | 'wrist';

export type Side = 'l' | 'r';

/** Human-readable label used in the log-entry UI. */
export const LIMB_LABELS: Record<Limb, string> = {
  thigh_mid: 'Thigh (mid)',
  calf_max: 'Calf (max)',
  ankle: 'Ankle',
  upper_arm: 'Upper arm',
  wrist: 'Wrist',
};

export interface LipedemaMeasurement {
  id: string;
  userId: string;
  recordedDate: string; // 'YYYY-MM-DD'
  thighMidLMm: number | null;
  thighMidRMm: number | null;
  calfMaxLMm: number | null;
  calfMaxRMm: number | null;
  ankleLMm: number | null;
  ankleRMm: number | null;
  upperArmLMm: number | null;
  upperArmRMm: number | null;
  wristLMm: number | null;
  wristRMm: number | null;
  pain_0_10: number | null;
  swelling_0_10: number | null;
  notes: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Edit-form shape: strings for text-input binding + nullable numbers. */
export interface MeasurementDraft {
  recordedDate: string;
  // cm with one decimal; stored as integer mm on save
  thighMidL: string;
  thighMidR: string;
  calfMaxL: string;
  calfMaxR: string;
  ankleL: string;
  ankleR: string;
  upperArmL: string;
  upperArmR: string;
  wristL: string;
  wristR: string;
  pain: string;
  swelling: string;
  notes: string;
}

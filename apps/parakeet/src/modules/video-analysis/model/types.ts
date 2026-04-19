import type {
  FormCoachingResult,
  VideoAnalysisResult,
} from '@parakeet/shared-types';

import type { DebugLandmarks } from '../lib/pose-types';

export interface SessionVideo {
  id: string;
  sessionId: string;
  lift: string;
  setNumber: number;
  sagittalConfidence: number;
  localUri: string;
  remoteUri: string | null;
  durationSec: number;
  analysis: VideoAnalysisResult | null;
  coachingResponse: FormCoachingResult | null;
  setWeightGrams: number | null;
  setReps: number | null;
  setRpe: number | null;
  recordedBy: string | null;
  recordedByName: string | null;
  videoWidthPx: number | null;
  videoHeightPx: number | null;
  /**
   * Raw pose landmarks captured during analysis, persisted so the playback
   * skeleton overlay can render without re-running MediaPipe. Null on rows
   * created before Phase 2 of backlog #19.
   */
  debugLandmarks: DebugLandmarks | null;
  createdAt: string;
}

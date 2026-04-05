import type {
  FormCoachingResult,
  VideoAnalysisResult,
} from '@parakeet/shared-types';

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
  createdAt: string;
}

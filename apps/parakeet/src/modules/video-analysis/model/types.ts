import type { VideoAnalysisResult, FormCoachingResult } from '@parakeet/shared-types';

export interface SessionVideo {
  id: string;
  sessionId: string;
  lift: string;
  setNumber: number;
  cameraAngle: 'side' | 'front';
  localUri: string;
  remoteUri: string | null;
  durationSec: number;
  analysis: VideoAnalysisResult | null;
  coachingResponse: FormCoachingResult | null;
  createdAt: string;
}

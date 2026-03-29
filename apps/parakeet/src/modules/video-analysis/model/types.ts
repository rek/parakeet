import type { VideoAnalysisResult } from '@parakeet/shared-types';

export interface SessionVideo {
  id: string;
  sessionId: string;
  lift: string;
  localUri: string;
  remoteUri: string | null;
  durationSec: number;
  analysis: VideoAnalysisResult | null;
  createdAt: string;
}

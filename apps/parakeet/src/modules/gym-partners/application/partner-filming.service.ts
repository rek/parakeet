import {
  analyzeVideoFrames,
  computeSagittalConfidence,
  extractFramesFromVideo,
} from '@modules/video-analysis';
import { toJson } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';
import { Video } from 'react-native-compressor';

import { insertPartnerSessionVideo } from '../data/partner-video.repository';
import { uploadPartnerVideo } from './partner-upload.service';

/**
 * Full partner filming pipeline: extract → detect → analyze → compress →
 * insert DB → upload storage → cleanup.
 *
 * Runs on the recorder's phone. Video is inserted into the lifter's account
 * via `insertPartnerSessionVideo` (user_id = lifter, recorded_by = recorder).
 */
export async function filmForPartner({
  videoUri,
  durationSec,
  targetUserId,
  sessionId,
  lift,
  setNumber,
  onProgress,
}: {
  videoUri: string;
  durationSec: number;
  targetUserId: string;
  sessionId: string;
  lift: string;
  setNumber: number;
  onProgress?: (pct: number) => void;
}) {
  onProgress?.(0.05);

  // 1. Extract pose frames (MediaPipe)
  const { frames, fps } = await extractFramesFromVideo({
    videoUri,
    durationSec,
    onProgress: (pct) => onProgress?.(0.05 + pct * 0.45),
  });

  onProgress?.(0.5);

  // 2. Auto-detect sagittal confidence from pose landmarks
  const resolvedConfidence = computeSagittalConfidence({ frames });

  // 3. Analyze frames (form faults, bar path, etc.)
  const liftKey = lift as 'squat' | 'bench' | 'deadlift';
  const isAnalyzable = ['squat', 'bench', 'deadlift'].includes(lift);
  const analysis = isAnalyzable
    ? analyzeVideoFrames({ frames, fps, lift: liftKey })
    : null;

  onProgress?.(0.6);

  // 4. Compress video
  let compressedUri: string;
  try {
    compressedUri = await Video.compress(videoUri, {
      compressionMethod: 'auto',
    });
  } catch (err) {
    captureException(err);
    compressedUri = videoUri;
  }

  onProgress?.(0.75);

  // 5. Insert DB row (lifter's account, with analysis JSONB)
  const { videoId } = await insertPartnerSessionVideo({
    targetUserId,
    sessionId,
    lift,
    setNumber,
    sagittalConfidence: resolvedConfidence,
    localUri: compressedUri,
    durationSec,
    analysis: analysis != null ? toJson(analysis) : undefined,
  });

  onProgress?.(0.85);

  // 6. Upload to lifter's storage folder (best-effort)
  await uploadPartnerVideo({
    lifterUserId: targetUserId,
    videoId,
    localUri: compressedUri,
  });

  onProgress?.(1.0);

  return { videoId, sagittalConfidence: resolvedConfidence, analysis };
}

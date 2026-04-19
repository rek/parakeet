import {
  FilesetResolver,
  PoseLandmarker,
} from '@mediapipe/tasks-vision';

import type { PoseFrame } from '@modules/video-analysis/lib/pose-types';

/** Public CDN URLs for the upstream MediaPipe pose-landmarker models. */
const MODEL_URLS = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  heavy: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
} as const;

export type ModelVariant = keyof typeof MODEL_URLS;

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';

interface CacheEntry {
  variant: ModelVariant;
  delegate: 'GPU' | 'CPU';
  landmarker: PoseLandmarker;
}

let cached: CacheEntry | null = null;

async function getLandmarker(
  variant: ModelVariant,
  delegate: 'GPU' | 'CPU'
): Promise<PoseLandmarker> {
  if (
    cached &&
    cached.variant === variant &&
    cached.delegate === delegate
  ) {
    return cached.landmarker;
  }
  cached?.landmarker.close();
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_URLS[variant],
      delegate,
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  cached = { variant, delegate, landmarker };
  return landmarker;
}

/** Wait for the video to seek to the requested timestamp. */
function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(new Error(`Video seek failed at ${timeSec}s`));
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.currentTime = timeSec;
  });
}

/** Zeroed 33-landmark frame for failed detections — keeps frame indexing aligned. */
function emptyFrame(): PoseFrame {
  return Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));
}

export interface ExtractionOptions {
  video: HTMLVideoElement;
  fps: number;
  variant: ModelVariant;
  delegate?: 'GPU' | 'CPU';
  /** Called with a value in [0, 1] after each processed frame. */
  onProgress?: (pct: number) => void;
  /** Optional cancel flag — checked between frames. */
  shouldCancel?: () => boolean;
}

export interface ExtractionResult {
  frames: PoseFrame[];
  fps: number;
  totalFrames: number;
  validFrames: number;
  durationSec: number;
  variant: ModelVariant;
  delegate: 'GPU' | 'CPU';
  elapsedMs: number;
}

/**
 * Extract pose landmarks from a video element by seeking + sampling at the
 * requested fps. Runs in the browser via MediaPipe Tasks Web (WebGL2 GPU
 * delegate by default; falls back to CPU if creation fails).
 *
 * The video element must already have its metadata loaded — the caller is
 * responsible for waiting on `loadedmetadata` before invoking. We pause the
 * video while extracting so seeks land cleanly.
 */
export async function extractLandmarksFromVideo({
  video,
  fps,
  variant,
  delegate = 'GPU',
  onProgress,
  shouldCancel,
}: ExtractionOptions): Promise<ExtractionResult> {
  if (!video.duration || !isFinite(video.duration)) {
    throw new Error('Video duration unknown — wait for loadedmetadata first');
  }

  let landmarker: PoseLandmarker;
  try {
    landmarker = await getLandmarker(variant, delegate);
  } catch (gpuErr) {
    if (delegate === 'GPU') {
      // Retry on CPU if GPU init fails (rare on modern browsers; here as safety)
      // eslint-disable-next-line no-console
      console.warn('GPU pose landmarker init failed, falling back to CPU', gpuErr);
      landmarker = await getLandmarker(variant, 'CPU');
      delegate = 'CPU';
    } else {
      throw gpuErr;
    }
  }

  const wasPaused = video.paused;
  if (!wasPaused) video.pause();

  const intervalSec = 1 / fps;
  const totalFrames = Math.max(1, Math.floor(video.duration * fps));
  const frames: PoseFrame[] = [];
  const startedAt = performance.now();
  let validFrames = 0;

  for (let i = 0; i < totalFrames; i++) {
    if (shouldCancel?.()) break;
    const t = i * intervalSec;
    await seekTo(video, t);
    // Some browsers need a microtask after `seeked` for the frame to be
    // ready in the video element's compositor. Drawing immediately works
    // in practice on Chromium; if blank frames appear, await a rAF here.
    const result = landmarker.detectForVideo(video, performance.now());
    const lms = result.landmarks?.[0];
    if (lms && lms.length >= 33) {
      const frame: PoseFrame = lms.map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility ?? 0,
      }));
      frames.push(frame);
      validFrames++;
    } else {
      frames.push(emptyFrame());
    }
    onProgress?.((i + 1) / totalFrames);
  }

  return {
    frames,
    fps,
    totalFrames,
    validFrames,
    durationSec: video.duration,
    variant,
    delegate,
    elapsedMs: performance.now() - startedAt,
  };
}

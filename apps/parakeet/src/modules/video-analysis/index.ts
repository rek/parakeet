export {
  insertSessionVideo,
  getVideoForSessionLift,
  getVideosForLift,
  deleteSessionVideo,
  updateSessionVideoAnalysis,
  updateSessionVideoCoaching,
} from './data/video.repository';
export type { SessionVideo } from './model/types';
export { analyzeVideoFrames, extractFramesFromVideo } from './application/analyze-video';
export { assembleCoachingContext } from './application/assemble-coaching-context';
export { uploadVideoToStorage } from './application/video-upload';
export type { FormCoachingContext } from './application/assemble-coaching-context';
export { useVideoAnalysis } from './hooks/useVideoAnalysis';
export { useFormCoaching } from './hooks/useFormCoaching';
export { usePreviousVideos } from './hooks/usePreviousVideos';
export { RepMetricsCard } from './ui/RepMetricsCard';
export { BarPathOverlay } from './ui/BarPathOverlay';
export { FormCoachingCard } from './ui/FormCoachingCard';
export { VideoEntryButton } from './ui/VideoEntryButton';
export { CameraAnglePicker } from './ui/CameraAnglePicker';
export { BaselineDeviationBadge } from './ui/BaselineDeviationBadge';
export { LongitudinalComparison } from './ui/LongitudinalComparison';
export { detectCameraAngle } from './lib/detect-camera-angle';
export { gradeRep } from './lib/competition-grader';
export type { RepVerdict, CriterionResult } from './lib/competition-grader';
export { computeReadinessFromVerdicts } from './lib/readiness-score';
export type { ReadinessScore } from './lib/readiness-score';
export { VerdictBadge } from './ui/VerdictBadge';
export { ReadinessCard } from './ui/ReadinessCard';
export {
  computePersonalBaseline,
  detectBaselineDeviations,
  MIN_VIDEOS_FOR_BASELINE,
} from './lib/personal-baseline';
export type { PersonalBaseline, BaselineDeviation } from './lib/personal-baseline';

// Native-dependent exports — import directly from the file path, not from
// this barrel, to avoid loading native modules at app startup.
// - VideoPlayerCard: requires expo-video
// - RecordVideoSheet: requires react-native-vision-camera
// - LiveSkeletonOverlay + useLivePoseOverlay: requires react-native-mediapipe
// These are safe to import in screens gated behind the videoAnalysis feature flag.
//
// VideoPlayerCard is intentionally NOT re-exported from this barrel because
// expo-video registers native modules on import, which would cause those
// modules to load eagerly at app startup for all screens. Import directly:
//   import { VideoPlayerCard } from '@modules/video-analysis/ui/VideoPlayerCard';
export type { VideoPlayerCard } from './ui/VideoPlayerCard';
export type { LiveLandmark } from './hooks/useLivePoseOverlay';

// --- Types ---
export type { SessionVideo } from './model/types';
export type { FormCoachingContext } from './application/assemble-coaching-context';
export type { RepVerdict, CriterionResult } from './lib/competition-grader';
export type { ReadinessScore } from './lib/readiness-score';
export type {
  PersonalBaseline,
  BaselineDeviation,
} from './lib/personal-baseline';
export type { AnalysisStrategy, StrategyName } from './lib/analysis-strategy';
export { STRATEGIES, DEFAULT_STRATEGY } from './lib/analysis-strategy';
export type { FatigueSignatures } from './lib/fatigue-signatures';
export { computeFatigueSignatures } from './lib/fatigue-signatures';
export { detectButtWink } from './lib/butt-wink-detector';
export { computeStanceWidth } from './lib/stance-width';
export { computeHipShift } from './lib/hip-shift';
export { computeElbowFlare } from './lib/elbow-flare';
export { assessPauseQuality } from './lib/pause-quality';
export { analyzeHipHingeTiming } from './lib/hip-hinge-timing';
export { computeBarToShinDistance } from './lib/bar-shin-distance';
export { computeLockoutStability } from './lib/lockout-stability';
export { normalizeVideoUri } from './lib/normalize-video-uri';

// --- Hooks (primary external API) ---
export { useVideoAnalysis } from './hooks/useVideoAnalysis';
export { usePostRestVideoCapture } from './hooks/usePostRestVideoCapture';
export { useFormCoaching } from './hooks/useFormCoaching';
export { usePreviousVideos } from './hooks/usePreviousVideos';
export { useSetVideo } from './hooks/useSetVideo';
export { useSessionVideos } from './hooks/useSessionVideos';

// --- Pure functions (used by screens for computation, not data access) ---
export {
  analyzeVideoFrames,
  extractFramesFromVideo,
} from './application/analyze-video';
export { assembleCoachingContext } from './application/assemble-coaching-context';
export {
  computeSagittalConfidence,
  deriveCameraAngle,
  detectCameraAngle,
} from './lib/view-confidence';
export { gradeRep } from './lib/competition-grader';
export { computeReadinessFromVerdicts } from './lib/readiness-score';
export {
  computePersonalBaseline,
  detectBaselineDeviations,
  MIN_VIDEOS_FOR_BASELINE,
} from './lib/personal-baseline';

// --- UI components ---
export { SetVideoIcon } from './ui/SetVideoIcon';
export { ShareVideoButton } from './ui/ShareVideoButton';
export { RepMetricsCard } from './ui/RepMetricsCard';
export { BarPathOverlay } from './ui/BarPathOverlay';
export { FormCoachingCard } from './ui/FormCoachingCard';
export { BaselineDeviationBadge } from './ui/BaselineDeviationBadge';
export { LongitudinalComparison } from './ui/LongitudinalComparison';
export { IntraSessionComparison } from './ui/IntraSessionComparison';
export { VerdictBadge } from './ui/VerdictBadge';
export { ReadinessCard } from './ui/ReadinessCard';

// --- Native-dependent UI components ---
// These load react-native-vision-camera and expo-video. Only import from
// screens that are navigated to on demand (not eagerly loaded at startup).
export { VideoPlayerCard } from './ui/VideoPlayerCard';
export { RecordVideoSheet } from './ui/RecordVideoSheet';
export { PostRestRecordButton } from './ui/PostRestRecordButton';
export type { LiveLandmark } from './hooks/useLivePoseOverlay';

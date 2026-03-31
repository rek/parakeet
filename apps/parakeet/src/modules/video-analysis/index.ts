// --- Types ---
export type { SessionVideo } from './model/types';
export type { FormCoachingContext } from './application/assemble-coaching-context';
export type { RepVerdict, CriterionResult } from './lib/competition-grader';
export type { ReadinessScore } from './lib/readiness-score';
export type { PersonalBaseline, BaselineDeviation } from './lib/personal-baseline';
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

// --- Hooks (primary external API) ---
export { useVideoAnalysis } from './hooks/useVideoAnalysis';
export { useFormCoaching } from './hooks/useFormCoaching';
export { usePreviousVideos } from './hooks/usePreviousVideos';
export { useSetVideo } from './hooks/useSetVideo';
export { useSessionVideos } from './hooks/useSessionVideos';

// --- Pure functions (used by screens for computation, not data access) ---
export { analyzeVideoFrames, extractFramesFromVideo } from './application/analyze-video';
export { assembleCoachingContext } from './application/assemble-coaching-context';
export { detectCameraAngle } from './lib/detect-camera-angle';
export { gradeRep } from './lib/competition-grader';
export { computeReadinessFromVerdicts } from './lib/readiness-score';
export {
  computePersonalBaseline,
  detectBaselineDeviations,
  MIN_VIDEOS_FOR_BASELINE,
} from './lib/personal-baseline';

// --- UI components ---
export { VideoEntryButton } from './ui/VideoEntryButton';
export { SetVideoIcon } from './ui/SetVideoIcon';
export { CameraAnglePicker } from './ui/CameraAnglePicker';
export { RepMetricsCard } from './ui/RepMetricsCard';
export { BarPathOverlay } from './ui/BarPathOverlay';
export { FormCoachingCard } from './ui/FormCoachingCard';
export { BaselineDeviationBadge } from './ui/BaselineDeviationBadge';
export { LongitudinalComparison } from './ui/LongitudinalComparison';
export { IntraSessionComparison } from './ui/IntraSessionComparison';
export { VerdictBadge } from './ui/VerdictBadge';
export { ReadinessCard } from './ui/ReadinessCard';

// --- Native-dependent exports ---
// Import directly from file path, NOT from this barrel, to avoid loading
// native modules at app startup. Safe in screens gated by videoAnalysis flag.
//   import { VideoPlayerCard } from '@modules/video-analysis/ui/VideoPlayerCard';
//   import { RecordVideoSheet } from '@modules/video-analysis/ui/RecordVideoSheet';
//   import { LiveSkeletonOverlay } from '@modules/video-analysis/ui/LiveSkeletonOverlay';
export type { VideoPlayerCard } from './ui/VideoPlayerCard';
export type { LiveLandmark } from './hooks/useLivePoseOverlay';

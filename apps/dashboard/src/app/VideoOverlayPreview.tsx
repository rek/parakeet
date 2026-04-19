import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  BarPathPoint,
  FatigueSignatures,
  FormFault,
  RepAnalysis,
  RepVerdict,
  VideoAnalysisResult,
} from '@parakeet/shared-types';

import { analyzeVideoFrames } from '@modules/video-analysis/application/analyze-frames';
import {
  findActiveRep,
  pickHeadDot,
} from '@modules/video-analysis/lib/playback-overlay-math';
import type { PoseFrame } from '@modules/video-analysis/lib/pose-types';
import { SKELETON_CONNECTIONS } from '@modules/video-analysis/lib/skeleton-connections';
import { computeDisplayRect } from '@modules/video-analysis/lib/video-display-rect';

import {
  extractLandmarksFromVideo,
  type ExtractionResult,
  type ModelVariant,
} from '../lib/browser-pose-extractor';
import manifest from '../../../../test-videos/manifest.json';
import { CoachPanel } from './coach/CoachPanel';

// Vite resolves these globs at build time. Each entry maps the source path to
// a dev-server URL (or hashed asset URL in prod build). We never bundle the
// video bytes — `query: '?url'` keeps them as references the browser fetches
// on demand.
const VIDEO_URLS = import.meta.glob(
  '../../../../test-videos/*.{mp4,3gp,mov}',
  { query: '?url', import: 'default', eager: true }
) as Record<string, string>;

const LANDMARK_URLS = import.meta.glob(
  '../../../../test-videos/landmarks/*.json',
  { query: '?url', import: 'default', eager: true }
) as Record<string, string>;

function videoUrlFor(file: string): string | undefined {
  return VIDEO_URLS[`../../../../test-videos/${file}`];
}

function landmarkUrlFor(id: string): string | undefined {
  return LANDMARK_URLS[`../../../../test-videos/landmarks/${id}.landmarks.json`];
}

interface ManifestVideo {
  id: string;
  file: string;
  lift: string;
  calibrated?: boolean;
  notes?: string;
  expected?: {
    sagittal_confidence?: { min?: number; max?: number };
    rep_count?: { min?: number; max?: number };
    faults_to_test?: string[];
    metrics_present?: string[];
    fatigue_signatures?: boolean;
  };
  actual?: {
    rep_count?: number;
    sagittal_confidence?: number;
    metric_summary?: Record<string, { mean: number; min: number; max: number }>;
  };
}

interface LandmarkFile {
  videoId: string;
  fps: number;
  totalFrames: number;
  validFrames: number;
  frames: PoseFrame[];
  /** When present, the landmarks were extracted in-browser at higher fps,
   * not loaded from the on-disk fixture. */
  source?: 'fixture' | 'browser';
  /** Extraction metadata when source === 'browser'. */
  extracted?: {
    variant: ModelVariant;
    delegate: 'GPU' | 'CPU';
    elapsedMs: number;
  };
}

const REP_PALETTE = [
  '#a3e635', // lime
  '#f97316', // orange
  '#2dd4bf', // teal
  '#f59e0b', // amber
  '#22c55e', // green
  '#ef4444', // red
] as const;

function repColor(repNumber: number): string {
  const idx = Math.max(0, repNumber - 1) % REP_PALETTE.length;
  return REP_PALETTE[idx];
}

const SUPPORTED_LIFTS = ['squat', 'bench', 'deadlift'] as const;
type Lift = (typeof SUPPORTED_LIFTS)[number];

function liftOf(video: ManifestVideo): Lift | null {
  return SUPPORTED_LIFTS.includes(video.lift as Lift)
    ? (video.lift as Lift)
    : null;
}

function videosWithFixtures(): ManifestVideo[] {
  // Cross-reference: dashboard only lists videos that have BOTH a landmarks
  // fixture and the source video file. The first is needed for analysis;
  // the second for playback.
  return (manifest.videos as ManifestVideo[]).filter(
    (v) => landmarkUrlFor(v.id) != null && videoUrlFor(v.file) != null
  );
}

export function VideoOverlayPreview() {
  const fixtures = useMemo(videosWithFixtures, []);
  const [selectedId, setSelectedId] = useState<string>(
    fixtures[0]?.id ?? ''
  );
  const [showBarPath, setShowBarPath] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [landmarks, setLandmarks] = useState<LandmarkFile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [extractFps, setExtractFps] = useState<number>(30);
  const [extractVariant, setExtractVariant] = useState<ModelVariant>('lite');
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractError, setExtractError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const [videoDims, setVideoDims] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selected = fixtures.find((v) => v.id === selectedId) ?? null;
  const videoUrl = selected ? (videoUrlFor(selected.file) ?? '') : '';

  // Fetch landmarks JSON when selection changes.
  // Cached browser extraction (written to .browser-cache/ by the vite
  // middleware) takes precedence over the committed fixture so a 30fps
  // re-extract survives reloads.
  useEffect(() => {
    if (!selected) {
      setLandmarks(null);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    setLandmarks(null);
    setCurrentTime(0);

    const fixtureUrl = landmarkUrlFor(selected.id);
    (async () => {
      try {
        const cached = await fetch(`/api/landmarks/${selected.id}`);
        if (cached.ok) {
          const json = (await cached.json()) as LandmarkFile;
          if (!cancelled) {
            setLandmarks({ ...json, source: json.source ?? 'browser' });
          }
          return;
        }
        if (!fixtureUrl) throw new Error('No landmarks available for fixture');
        const fixture = await fetch(fixtureUrl);
        if (!fixture.ok) throw new Error(`HTTP ${fixture.status}`);
        const json = (await fixture.json()) as LandmarkFile;
        if (!cancelled) setLandmarks({ ...json, source: 'fixture' });
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Failed to load landmarks'
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Run analysis when landmarks + lift are ready
  const analysis = useMemo<VideoAnalysisResult | null>(() => {
    if (!landmarks || !selected) return null;
    const lift = liftOf(selected);
    if (!lift) return null;
    if (landmarks.frames.length === 0) return null;
    try {
      return analyzeVideoFrames({
        frames: landmarks.frames,
        fps: landmarks.fps,
        lift,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('analyzeVideoFrames failed', err);
      return null;
    }
  }, [landmarks, selected]);

  // Track video element timeupdate
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onMeta = () =>
      setVideoDims({ width: v.videoWidth, height: v.videoHeight });
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
    };
  }, [videoUrl]);

  // Track wrapper layout for letterbox math
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const displayRect = useMemo(() => {
    if (!containerSize) return null;
    return computeDisplayRect({
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
      videoWidthPx: videoDims?.width ?? null,
      videoHeightPx: videoDims?.height ?? null,
    });
  }, [containerSize, videoDims]);

  const handleExtract = async () => {
    const v = videoRef.current;
    if (!v || !selected) return;
    if (!v.duration || !isFinite(v.duration)) {
      setExtractError('Video metadata not loaded yet — wait for it to be ready.');
      return;
    }
    setExtracting(true);
    setExtractProgress(0);
    setExtractError(null);
    cancelRef.current = false;
    try {
      const result: ExtractionResult = await extractLandmarksFromVideo({
        video: v,
        fps: extractFps,
        variant: extractVariant,
        onProgress: setExtractProgress,
        shouldCancel: () => cancelRef.current,
      });
      const extracted: LandmarkFile = {
        videoId: selected.id,
        fps: result.fps,
        totalFrames: result.totalFrames,
        validFrames: result.validFrames,
        frames: result.frames,
        source: 'browser',
        extracted: {
          variant: result.variant,
          delegate: result.delegate,
          elapsedMs: result.elapsedMs,
        },
      };
      setLandmarks(extracted);
      setShowSkeleton(true);
      // Reset playback to start so the new skeleton renders cleanly
      v.currentTime = 0;

      // Persist to .browser-cache/ so the result survives page reloads.
      // Failure is non-fatal — the landmarks are still in-memory for this session.
      fetch(`/api/landmarks/${selected.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extracted),
      }).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('landmark cache save failed', err);
      });
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleCancelExtract = () => {
    cancelRef.current = true;
  };

  const handleDownloadLandmarks = () => {
    if (!landmarks || !selected) return;
    const json = {
      videoId: landmarks.videoId,
      fps: landmarks.fps,
      totalFrames: landmarks.totalFrames,
      validFrames: landmarks.validFrames,
      frames: landmarks.frames,
    };
    const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected.id}.${landmarks.fps}fps.${landmarks.extracted?.variant ?? 'lite'}.landmarks.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ color: 'var(--text-bright)' }}>
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: 0,
            color: 'var(--text-bright)',
          }}
        >
          Video Overlay Preview
        </h1>
        <div
          style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}
        >
          Test bar-path and skeleton overlays against calibration fixtures.
          Renders the same pure libs the mobile app uses.
        </div>
      </header>

      <FixturePicker
        videos={fixtures}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {loadError && (
        <div
          style={{
            color: 'var(--red)',
            padding: 8,
            border: '1px solid var(--red)',
            borderRadius: 4,
            marginTop: 12,
            fontSize: 12,
          }}
        >
          Landmarks load error: {loadError}
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <ToggleChip
          label="Bar path"
          enabled={showBarPath}
          onToggle={() => setShowBarPath((v) => !v)}
        />
        <ToggleChip
          label="Skeleton"
          enabled={showSkeleton}
          onToggle={() => setShowSkeleton((v) => !v)}
          available={!!landmarks}
          subLabel={landmarks ? null : 'No landmarks loaded'}
        />
      </div>

      <ExtractionPanel
        fps={extractFps}
        onFpsChange={setExtractFps}
        variant={extractVariant}
        onVariantChange={setExtractVariant}
        extracting={extracting}
        progress={extractProgress}
        error={extractError}
        landmarksSource={landmarks?.source ?? null}
        extractedMeta={landmarks?.extracted ?? null}
        landmarksFps={landmarks?.fps ?? null}
        landmarksValidFrames={landmarks?.validFrames ?? null}
        landmarksTotalFrames={landmarks?.totalFrames ?? null}
        canExtract={!!videoUrl && !!videoDims}
        canDownload={!!landmarks && landmarks.source === 'browser'}
        onExtract={handleExtract}
        onCancel={handleCancelExtract}
        onDownload={handleDownloadLandmarks}
      />

      <div
        ref={wrapperRef}
        style={{
          marginTop: 16,
          position: 'relative',
          background: '#000',
          borderRadius: 6,
          overflow: 'hidden',
          aspectRatio: '16 / 9',
          width: '100%',
        }}
      >
        {videoUrl && (
          <video
            ref={videoRef}
            key={videoUrl}
            src={videoUrl}
            controls
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          >
            <track kind="captions" />
          </video>
        )}
        {showBarPath && analysis && displayRect && (
          <BarPathOverlaySvg
            analysis={analysis}
            currentTime={currentTime}
            displayRect={displayRect}
          />
        )}
        {showSkeleton && landmarks && displayRect && (
          <SkeletonOverlaySvg
            frames={landmarks.frames}
            fps={landmarks.fps}
            currentTime={currentTime}
            displayRect={displayRect}
          />
        )}
      </div>

      {selected && (
        <MetadataPanel
          video={selected}
          landmarks={landmarks}
          analysis={analysis}
          videoDims={videoDims}
        />
      )}

      {selected && analysis && (
        <CalibrationCheck video={selected} analysis={analysis} />
      )}

      {analysis && analysis.fatigueSignatures && (
        <FatigueSignaturesPanel signatures={analysis.fatigueSignatures} />
      )}

      {analysis && analysis.reps.length > 0 && (
        <RepTable
          analysis={analysis}
          currentTime={currentTime}
          onSeek={(timeSec) => {
            const v = videoRef.current;
            if (v) v.currentTime = timeSec;
          }}
        />
      )}

      {analysis && selected && liftOf(selected) && (
        <CoachPanel
          fixtureId={selected.id}
          analysis={analysis}
          lift={liftOf(selected) as 'squat' | 'bench' | 'deadlift'}
          sagittalConfidence={analysis.sagittalConfidence}
          previousAnalyses={[]}
        />
      )}

      {selected?.notes && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: 4,
            fontSize: 11,
            color: 'var(--text-dim)',
            fontFamily: 'var(--mono)',
            lineHeight: 1.5,
          }}
        >
          <span
            style={{
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: 9,
              marginRight: 6,
            }}
          >
            Notes
          </span>
          {selected.notes}
        </div>
      )}
    </div>
  );
}

function ExtractionPanel({
  fps,
  onFpsChange,
  variant,
  onVariantChange,
  extracting,
  progress,
  error,
  landmarksSource,
  extractedMeta,
  landmarksFps,
  landmarksValidFrames,
  landmarksTotalFrames,
  canExtract,
  canDownload,
  onExtract,
  onCancel,
  onDownload,
}: {
  fps: number;
  onFpsChange: (v: number) => void;
  variant: ModelVariant;
  onVariantChange: (v: ModelVariant) => void;
  extracting: boolean;
  progress: number;
  error: string | null;
  landmarksSource: 'fixture' | 'browser' | null;
  extractedMeta: { variant: ModelVariant; delegate: 'GPU' | 'CPU'; elapsedMs: number } | null;
  landmarksFps: number | null;
  landmarksValidFrames: number | null;
  landmarksTotalFrames: number | null;
  canExtract: boolean;
  canDownload: boolean;
  onExtract: () => void;
  onCancel: () => void;
  onDownload: () => void;
}) {
  const FPS_OPTIONS = [10, 15, 24, 30, 60];
  const VARIANT_OPTIONS: { value: ModelVariant; label: string }[] = [
    { value: 'lite', label: 'Lite (5.6MB)' },
    { value: 'full', label: 'Full (9MB)' },
    { value: 'heavy', label: 'Heavy (29MB)' },
  ];

  return (
    <div
      style={{
        marginTop: 12,
        padding: '12px 14px',
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--surface)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Re-extract on desktop
        </span>
        {landmarksSource === 'fixture' && landmarksFps != null && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            current: {landmarksFps}fps fixture
          </span>
        )}
        {landmarksSource === 'browser' && extractedMeta && (
          <span style={{ fontSize: 10, color: 'var(--green)' }}>
            current: {landmarksFps}fps · {extractedMeta.variant} · {extractedMeta.delegate}
            {' · '}
            {(extractedMeta.elapsedMs / 1000).toFixed(1)}s
            {' · '}
            {landmarksValidFrames}/{landmarksTotalFrames} valid
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          fps&nbsp;
          <select
            value={fps}
            onChange={(e) => onFpsChange(Number(e.target.value))}
            disabled={extracting}
            style={selectStyle}
          >
            {FPS_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          model&nbsp;
          <select
            value={variant}
            onChange={(e) => onVariantChange(e.target.value as ModelVariant)}
            disabled={extracting}
            style={selectStyle}
          >
            {VARIANT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {!extracting ? (
          <button
            onClick={onExtract}
            disabled={!canExtract}
            style={{
              ...buttonStyle,
              background: canExtract ? 'var(--accent)' : 'var(--surface-overlay)',
              color: canExtract ? '#000' : 'var(--text-muted)',
              cursor: canExtract ? 'pointer' : 'not-allowed',
            }}
          >
            Extract
          </button>
        ) : (
          <button
            onClick={onCancel}
            style={{
              ...buttonStyle,
              background: 'var(--red-dim)',
              color: 'var(--red)',
              border: '1px solid var(--red)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}

        <button
          onClick={onDownload}
          disabled={!canDownload}
          title={
            canDownload
              ? 'Download landmarks JSON'
              : 'Run extraction first to enable download'
          }
          style={{
            ...buttonStyle,
            background: canDownload ? 'var(--blue-dim)' : 'transparent',
            color: canDownload ? 'var(--blue)' : 'var(--text-muted)',
            border: `1px solid ${canDownload ? 'var(--blue)' : 'var(--border)'}`,
            cursor: canDownload ? 'pointer' : 'not-allowed',
          }}
        >
          Download JSON
        </button>
      </div>

      {extracting && (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              height: 4,
              background: 'var(--surface-overlay)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.round(progress * 100)}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 0.15s',
              }}
            />
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--mono)',
            }}
          >
            {(progress * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 10,
            padding: '6px 10px',
            border: '1px solid var(--red)',
            background: 'var(--red-dim)',
            color: 'var(--red)',
            fontSize: 11,
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  padding: '4px 6px',
  fontFamily: 'var(--mono)',
  fontSize: 11,
} as const;

const buttonStyle = {
  padding: '6px 14px',
  borderRadius: 4,
  border: '1px solid transparent',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
} as const;

function FixturePicker({
  videos,
  selectedId,
  onSelect,
}: {
  videos: ManifestVideo[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const out: Record<string, ManifestVideo[]> = {};
    for (const v of videos) {
      (out[v.lift] ??= []).push(v);
    }
    return out;
  }, [videos]);

  return (
    <select
      value={selectedId}
      onChange={(e) => onSelect(e.target.value)}
      style={{
        background: 'var(--surface)',
        color: 'var(--text)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '6px 8px',
        fontFamily: 'var(--mono)',
        fontSize: 13,
        minWidth: 320,
      }}
    >
      {Object.entries(grouped).map(([lift, items]) => (
        <optgroup key={lift} label={lift.toUpperCase()}>
          {items.map((v) => (
            <option key={v.id} value={v.id}>
              {v.id}
              {v.calibrated ? ' ✓' : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function ToggleChip({
  label,
  enabled,
  onToggle,
  available = true,
  subLabel,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  available?: boolean;
  subLabel?: string | null;
}) {
  return (
    <button
      onClick={available ? onToggle : undefined}
      disabled={!available}
      style={{
        padding: '6px 14px',
        borderRadius: 999,
        border: enabled
          ? '1px solid var(--accent)'
          : '1px solid var(--border)',
        background: enabled ? 'var(--accent)' : 'transparent',
        color: enabled ? '#000' : 'var(--text-dim)',
        fontFamily: 'var(--mono)',
        fontSize: 12,
        fontWeight: 500,
        cursor: available ? 'pointer' : 'not-allowed',
        opacity: available ? 1 : 0.45,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
      }}
    >
      <span>{label}</span>
      {subLabel != null && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {subLabel}
        </span>
      )}
    </button>
  );
}

function BarPathOverlaySvg({
  analysis,
  currentTime,
  displayRect,
}: {
  analysis: VideoAnalysisResult;
  currentTime: number;
  displayRect: { width: number; height: number; offsetX: number; offsetY: number };
}) {
  const { width, height, offsetX, offsetY } = displayRect;
  if (width <= 0 || height <= 0) return null;
  if (analysis.reps.length === 0) return null;

  const currentFrame = currentTime * analysis.fps;
  const activeRep = findActiveRep({ reps: analysis.reps, currentFrame });
  const headDot = activeRep
    ? pickHeadDot({ barPath: activeRep.barPath, currentFrame })
    : null;
  const headColor = activeRep ? repColor(activeRep.repNumber) : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        left: offsetX,
        top: offsetY,
        pointerEvents: 'none',
      }}
    >
      {analysis.reps.map((rep: RepAnalysis) => {
        if (rep.barPath.length === 0) return null;
        const color = repColor(rep.repNumber);
        const polylinePoints = rep.barPath
          .map((p: BarPathPoint) => `${p.x * width},${p.y * height}`)
          .join(' ');
        const start = rep.barPath[0];
        return (
          <g key={rep.repNumber}>
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
            <text
              x={start.x * width + 8}
              y={start.y * height - 8}
              fontSize={10}
              fontWeight="bold"
              fill={color}
              stroke="#000"
              strokeWidth={0.5}
            >
              {`R${rep.repNumber}`}
            </text>
          </g>
        );
      })}
      {headDot && headColor && (
        <circle
          cx={headDot.x * width}
          cy={headDot.y * height}
          r={6}
          fill={headColor}
          stroke="#fff"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}

/**
 * Primary threshold — matches the per-landmark gate used across the
 * video-analysis lib. Landmarks above this get the full-confidence teal
 * colour.
 */
const MIN_VISIBILITY = 0.5;

/**
 * Secondary threshold — landmarks between `LOW_VIS_FLOOR` and
 * `MIN_VISIBILITY` get a faded red treatment so the viewer can tell
 * "landmark is there but MediaPipe is unsure" apart from "landmark not
 * detected at all". Below the floor, the landmark is essentially a
 * zero output — nothing worth drawing.
 */
const LOW_VIS_FLOOR = 0.1;

function SkeletonOverlaySvg({
  frames,
  fps,
  currentTime,
  displayRect,
}: {
  frames: PoseFrame[];
  fps: number;
  currentTime: number;
  displayRect: { width: number; height: number; offsetX: number; offsetY: number };
}) {
  const { width, height, offsetX, offsetY } = displayRect;
  if (width <= 0 || height <= 0) return null;
  if (frames.length === 0) return null;

  const frameIdxFloat = Math.max(
    0,
    Math.min(frames.length - 1, currentTime * fps)
  );
  const lo = Math.floor(frameIdxFloat);
  const hi = Math.min(frames.length - 1, Math.ceil(frameIdxFloat));
  const t = frameIdxFloat - lo;
  const loFrame = frames[lo];
  const hiFrame = frames[hi];
  // Visibility: pick the nearest stored frame (avoid lerping a flicker)
  const nearest = t < 0.5 ? loFrame : hiFrame;

  const lerped = loFrame.map((lm, i) => ({
    x: lm.x + (hiFrame[i].x - lm.x) * t,
    y: lm.y + (hiFrame[i].y - lm.y) * t,
    visibility: nearest[i].visibility,
  }));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        left: offsetX,
        top: offsetY,
        pointerEvents: 'none',
      }}
    >
      {SKELETON_CONNECTIONS.map(([a, b], i) => {
        const la = lerped[a];
        const lb = lerped[b];
        if (!la || !lb) return null;
        const endpointMin = Math.min(la.visibility, lb.visibility);
        if (endpointMin < LOW_VIS_FLOOR) return null;
        const lowConfidence = endpointMin < MIN_VISIBILITY;
        return (
          <line
            key={i}
            x1={la.x * width}
            y1={la.y * height}
            x2={lb.x * width}
            y2={lb.y * height}
            stroke={lowConfidence ? '#ef4444' : '#2dd4bf'}
            strokeWidth={lowConfidence ? 1 : 2}
            opacity={lowConfidence ? 0.35 : 0.8}
            strokeDasharray={lowConfidence ? '3 3' : undefined}
          />
        );
      })}
      {lerped.map((lm, i) => {
        if (lm.visibility < LOW_VIS_FLOOR) return null;
        const lowConfidence = lm.visibility < MIN_VISIBILITY;
        return (
          <circle
            key={i}
            cx={lm.x * width}
            cy={lm.y * height}
            r={lowConfidence ? 2 : 3}
            fill={lowConfidence ? '#ef4444' : '#2dd4bf'}
            opacity={lowConfidence ? 0.5 : 0.9}
          />
        );
      })}
    </svg>
  );
}

function MetadataPanel({
  video,
  landmarks,
  analysis,
  videoDims,
}: {
  video: ManifestVideo;
  landmarks: LandmarkFile | null;
  analysis: VideoAnalysisResult | null;
  videoDims: { width: number; height: number } | null;
}) {
  return (
    <div
      style={{
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        fontSize: 12,
        color: 'var(--text-dim)',
      }}
    >
      <Stat label="Lift" value={video.lift} />
      <Stat label="Calibrated" value={video.calibrated ? 'yes' : 'no'} />
      <Stat
        label="Expected reps"
        value={video.actual?.rep_count?.toString() ?? '—'}
      />
      <Stat
        label="Source FPS"
        value={landmarks ? landmarks.fps.toString() : '—'}
      />
      <Stat
        label="Frames stored"
        value={
          landmarks
            ? `${landmarks.validFrames}/${landmarks.totalFrames}`
            : '—'
        }
      />
      <Stat
        label="Analysed reps"
        value={analysis ? analysis.reps.length.toString() : '—'}
      />
      <Stat
        label="Sagittal conf."
        value={
          analysis ? analysis.sagittalConfidence.toFixed(2) : '—'
        }
      />
      <Stat
        label="Video dims"
        value={
          videoDims ? `${videoDims.width}×${videoDims.height}` : '—'
        }
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        padding: '8px 10px',
        borderRadius: 4,
      }}
    >
      <div
        style={{
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ color: 'var(--text-bright)', fontFamily: 'var(--mono)' }}>
        {value}
      </div>
    </div>
  );
}

// ── Calibration check ───────────────────────────────────────────────────────

interface CheckResult {
  label: string;
  pass: boolean | null;
  detail: string;
}

function buildCalibrationChecks(
  video: ManifestVideo,
  analysis: VideoAnalysisResult
): CheckResult[] {
  const expected = video.expected;
  if (!expected) return [];
  const checks: CheckResult[] = [];

  // Sagittal confidence range
  if (expected.sagittal_confidence) {
    const { min, max } = expected.sagittal_confidence;
    const v = analysis.sagittalConfidence;
    const inRange = (min == null || v >= min) && (max == null || v <= max);
    checks.push({
      label: 'Sagittal confidence',
      pass: inRange,
      detail: `${v.toFixed(2)} (expected ${min ?? '–∞'} – ${max ?? '∞'})`,
    });
  }

  // Rep count range
  if (expected.rep_count) {
    const { min, max } = expected.rep_count;
    const reps = analysis.reps.length;
    const inRange = (min == null || reps >= min) && (max == null || reps <= max);
    checks.push({
      label: 'Rep count',
      pass: inRange,
      detail: `${reps} (expected ${min ?? '–'} – ${max ?? '∞'})`,
    });
  }

  // Faults that should fire
  if (expected.faults_to_test) {
    const allFaults = new Set(
      analysis.reps.flatMap((r) => r.faults.map((f) => f.type))
    );
    for (const ft of expected.faults_to_test) {
      checks.push({
        label: `Fault detected: ${ft}`,
        pass: allFaults.has(ft),
        detail: allFaults.has(ft) ? 'fired in ≥1 rep' : 'not detected',
      });
    }
  }

  // Metrics that must be populated in at least one rep
  if (expected.metrics_present) {
    for (const m of expected.metrics_present) {
      const present = analysis.reps.some((r) => {
        const value = (r as unknown as Record<string, unknown>)[m];
        return typeof value === 'number' && Number.isFinite(value);
      });
      checks.push({
        label: `Metric present: ${m}`,
        pass: present,
        detail: present ? 'computed' : 'missing in all reps',
      });
    }
  }

  // Fatigue signatures presence
  if (expected.fatigue_signatures) {
    const present = analysis.fatigueSignatures != null;
    checks.push({
      label: 'Fatigue signatures',
      pass: present,
      detail: present ? 'computed' : 'missing',
    });
  }

  return checks;
}

function CalibrationCheck({
  video,
  analysis,
}: {
  video: ManifestVideo;
  analysis: VideoAnalysisResult;
}) {
  const checks = useMemo(
    () => buildCalibrationChecks(video, analysis),
    [video, analysis]
  );
  if (checks.length === 0) return null;
  const passed = checks.filter((c) => c.pass === true).length;
  const failed = checks.filter((c) => c.pass === false).length;
  const allGood = failed === 0;

  return (
    <div
      style={{
        marginTop: 16,
        padding: '12px 14px',
        background: 'var(--surface)',
        border: `1px solid ${allGood ? 'var(--green-border)' : 'var(--red-border)'}`,
        borderRadius: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Calibration check
        </span>
        <span
          style={{
            fontSize: 11,
            color: allGood ? 'var(--green)' : 'var(--red)',
            fontFamily: 'var(--mono)',
            fontWeight: 600,
          }}
        >
          {passed}/{checks.length} pass
        </span>
        {video.calibrated && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            video flagged calibrated
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '20px 1fr auto',
          rowGap: 4,
          columnGap: 10,
          fontFamily: 'var(--mono)',
          fontSize: 11,
        }}
      >
        {checks.map((c, i) => (
          <CheckRow key={i} check={c} />
        ))}
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: CheckResult }) {
  const color =
    check.pass === true
      ? 'var(--green)'
      : check.pass === false
        ? 'var(--red)'
        : 'var(--text-muted)';
  const icon = check.pass === true ? '✓' : check.pass === false ? '✕' : '·';
  return (
    <>
      <span style={{ color, fontWeight: 700 }}>{icon}</span>
      <span style={{ color: 'var(--text)' }}>{check.label}</span>
      <span style={{ color: 'var(--text-dim)' }}>{check.detail}</span>
    </>
  );
}

// ── Fatigue signatures ──────────────────────────────────────────────────────

function FatigueSignaturesPanel({
  signatures,
}: {
  signatures: FatigueSignatures;
}) {
  const rows: { label: string; value: string; color: string }[] = [
    {
      label: 'Forward lean drift',
      value: fmtDeg(signatures.forwardLeanDriftDeg),
      color: signedColor(signatures.forwardLeanDriftDeg, true),
    },
    {
      label: 'Bar drift increase',
      value: fmtCm(signatures.barDriftIncreaseCm),
      color: signedColor(signatures.barDriftIncreaseCm, true),
    },
    {
      label: 'ROM compression',
      value: fmtCm(signatures.romCompressionCm),
      color: signedColor(signatures.romCompressionCm, true),
    },
    {
      label: 'Descent speed change',
      value:
        signatures.descentSpeedChange != null
          ? `${(signatures.descentSpeedChange * 100).toFixed(1)}%`
          : '—',
      color: signedColor(signatures.descentSpeedChange, true),
    },
    {
      label: 'Lockout degradation',
      value: fmtDeg(signatures.lockoutDegradationDeg),
      color: signedColor(signatures.lockoutDegradationDeg, true),
    },
    {
      label: 'Velocity loss trend',
      value: signatures.velocityLossTrend ?? '—',
      color:
        signatures.velocityLossTrend === 'increasing'
          ? 'var(--red)'
          : signatures.velocityLossTrend === 'decreasing'
            ? 'var(--green)'
            : 'var(--text-dim)',
    },
  ];

  return (
    <div
      style={{
        marginTop: 16,
        padding: '12px 14px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 10,
        }}
      >
        Fatigue signatures
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 8,
        }}
      >
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              padding: '6px 10px',
              background: 'var(--surface-overlay)',
              borderRadius: 3,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {r.label}
            </div>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 13,
                fontWeight: 600,
                color: r.color,
              }}
            >
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtDeg(v: number | null) {
  return v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}°` : '—';
}

function fmtCm(v: number | null) {
  return v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}cm` : '—';
}

function signedColor(v: number | null, redIfPositive: boolean) {
  if (v == null) return 'var(--text-dim)';
  if (Math.abs(v) < 0.01) return 'var(--text-dim)';
  const positive = v > 0;
  if (positive === redIfPositive) return 'var(--red)';
  return 'var(--green)';
}

// ── Per-rep table ───────────────────────────────────────────────────────────

function verdictBadge(v: RepVerdict | undefined) {
  if (!v) return { label: '—', color: 'var(--text-muted)', bg: 'transparent' };
  if (v.verdict === 'white_light')
    return { label: 'PASS', color: 'var(--green)', bg: 'var(--green-dim)' };
  if (v.verdict === 'borderline')
    return { label: 'BORD', color: 'var(--accent)', bg: 'var(--accent-dim)' };
  return { label: 'FAIL', color: 'var(--red)', bg: 'var(--red-dim)' };
}

function faultSeverityColor(s: FormFault['severity']) {
  if (s === 'critical') return { color: 'var(--red)', bg: 'var(--red-dim)' };
  if (s === 'warning')
    return { color: 'var(--accent)', bg: 'var(--accent-dim)' };
  return { color: 'var(--text-dim)', bg: 'var(--surface-overlay)' };
}

const REP_METRIC_FIELDS: { key: keyof RepAnalysis; label: string; unit: string }[] = [
  { key: 'maxDepthCm', label: 'Depth', unit: 'cm' },
  { key: 'forwardLeanDeg', label: 'Lean', unit: '°' },
  { key: 'barDriftCm', label: 'Drift', unit: 'cm' },
  { key: 'romCm', label: 'ROM', unit: 'cm' },
  { key: 'kneeAngleDeg', label: 'Knee', unit: '°' },
  { key: 'hipAngleAtLockoutDeg', label: 'Hip lockout', unit: '°' },
  { key: 'meanConcentricVelocityCmS', label: 'MCV', unit: 'cm/s' },
  { key: 'velocityLossPct', label: 'Vel loss', unit: '%' },
  { key: 'estimatedRir', label: 'Est RIR', unit: '' },
  { key: 'concentricDurationSec', label: 'Conc', unit: 's' },
  { key: 'eccentricDurationSec', label: 'Ecc', unit: 's' },
  { key: 'tempoRatio', label: 'Tempo', unit: 'x' },
  { key: 'buttWinkDeg', label: 'Butt wink', unit: '°' },
  { key: 'stanceWidthCm', label: 'Stance', unit: 'cm' },
  { key: 'hipShiftCm', label: 'Hip shift', unit: 'cm' },
  { key: 'elbowFlareDeg', label: 'Elbow flare', unit: '°' },
  { key: 'pauseDurationSec', label: 'Pause', unit: 's' },
  { key: 'hipHingeCrossoverPct', label: 'Hinge x-over', unit: '%' },
  { key: 'barToShinDistanceCm', label: 'Bar→shin', unit: 'cm' },
  { key: 'lockoutStabilityCv', label: 'Lockout CV', unit: '' },
];

function RepTable({
  analysis,
  currentTime,
  onSeek,
}: {
  analysis: VideoAnalysisResult;
  currentTime: number;
  onSeek: (timeSec: number) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const currentFrame = currentTime * analysis.fps;

  const passCount = analysis.reps.filter(
    (r) => r.verdict?.verdict === 'white_light'
  ).length;
  const borderlineCount = analysis.reps.filter(
    (r) => r.verdict?.verdict === 'borderline'
  ).length;
  const failCount = analysis.reps.filter(
    (r) => r.verdict?.verdict === 'red_light'
  ).length;
  const totalFaults = analysis.reps.reduce((n, r) => n + r.faults.length, 0);

  return (
    <div
      style={{
        marginTop: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Per-rep analysis
        </span>
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>
          <span style={{ color: 'var(--text-muted)' }}>reps: </span>
          <span style={{ color: 'var(--text-bright)' }}>
            {analysis.reps.length}
          </span>
        </span>
        {(passCount > 0 || borderlineCount > 0 || failCount > 0) && (
          <span style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>
            <span style={{ color: 'var(--text-muted)' }}>verdict: </span>
            <span style={{ color: 'var(--green)' }}>{passCount}p</span>
            {' · '}
            <span style={{ color: 'var(--accent)' }}>{borderlineCount}b</span>
            {' · '}
            <span style={{ color: 'var(--red)' }}>{failCount}f</span>
          </span>
        )}
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>
          <span style={{ color: 'var(--text-muted)' }}>faults: </span>
          <span
            style={{
              color: totalFaults > 0 ? 'var(--accent)' : 'var(--green)',
            }}
          >
            {totalFaults}
          </span>
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 60px 80px 80px 80px 80px 80px 1fr',
          gap: 10,
          padding: '8px 14px',
          borderBottom: '1px solid var(--border)',
          fontSize: 10,
          fontFamily: 'var(--mono)',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        <span>#</span>
        <span>Verdict</span>
        <span>Depth</span>
        <span>Lean</span>
        <span>Drift</span>
        <span>ROM</span>
        <span>RIR</span>
        <span>Faults</span>
      </div>

      {analysis.reps.map((rep, idx) => {
        const nextStart = analysis.reps[idx + 1]?.startFrame ?? Infinity;
        const isActive =
          currentFrame >= rep.startFrame && currentFrame < nextStart;
        const isExpanded = expanded === rep.repNumber;
        const v = verdictBadge(rep.verdict);
        return (
          <div key={rep.repNumber}>
            <button
              type="button"
              onClick={() => {
                const opening = expanded !== rep.repNumber;
                setExpanded(opening ? rep.repNumber : null);
                if (opening) onSeek(rep.startFrame / analysis.fps);
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 60px 80px 80px 80px 80px 80px 1fr',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                borderTop: 'none',
                borderRight: 'none',
                fontSize: 12,
                fontFamily: 'var(--mono)',
                color: 'var(--text)',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                background: isExpanded
                  ? 'var(--surface-overlay)'
                  : isActive
                    ? 'var(--surface-hover)'
                    : 'transparent',
                borderLeft: isActive
                  ? '3px solid var(--accent)'
                  : isExpanded
                    ? '3px solid var(--text-dim)'
                    : '3px solid transparent',
              }}
            >
              <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
                R{rep.repNumber}
              </span>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: v.color,
                  background: v.bg,
                  border: `1px solid ${v.color}`,
                  textAlign: 'center',
                }}
              >
                {v.label}
              </span>
              <span>{fmtVal(rep.maxDepthCm, 'cm')}</span>
              <span>{fmtVal(rep.forwardLeanDeg, '°')}</span>
              <span>{fmtVal(rep.barDriftCm, 'cm')}</span>
              <span>{fmtVal(rep.romCm, 'cm')}</span>
              <span>{fmtVal(rep.estimatedRir, '')}</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {rep.faults.length === 0 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                    none
                  </span>
                )}
                {rep.faults.map((f, i) => {
                  const c = faultSeverityColor(f.severity);
                  return (
                    <span
                      key={i}
                      title={f.message}
                      style={{
                        padding: '1px 6px',
                        borderRadius: 3,
                        fontSize: 9,
                        fontWeight: 600,
                        color: c.color,
                        background: c.bg,
                        border: `1px solid ${c.color}`,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {f.type}
                    </span>
                  );
                })}
              </div>
            </button>
            {isExpanded && (
              <RepDetail rep={rep} analysisFps={analysis.fps} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function fmtVal(v: number | undefined, unit: string) {
  if (v == null || !Number.isFinite(v))
    return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return (
    <span>
      {v.toFixed(1)}
      <span style={{ color: 'var(--text-muted)', marginLeft: 1 }}>{unit}</span>
    </span>
  );
}

function RepDetail({
  rep,
  analysisFps,
}: {
  rep: RepAnalysis;
  analysisFps: number;
}) {
  const cells = REP_METRIC_FIELDS.map((f) => {
    const value = rep[f.key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return (
      <div
        key={String(f.key)}
        style={{
          padding: '6px 8px',
          background: 'var(--surface-overlay)',
          borderRadius: 3,
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {f.label}
        </div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: 'var(--text-bright)',
          }}
        >
          {value.toFixed(2)}
          <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>
            {f.unit}
          </span>
        </div>
      </div>
    );
  }).filter(Boolean);

  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--surface-overlay)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          fontFamily: 'var(--mono)',
        }}
      >
        Frames {rep.startFrame} → {rep.endFrame}
        {' · '}
        {((rep.endFrame - rep.startFrame) / analysisFps).toFixed(2)}s
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 6,
        }}
      >
        {cells}
      </div>

      {rep.verdict && rep.verdict.criteria.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 9,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            Judging criteria
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              rowGap: 4,
              columnGap: 10,
              fontFamily: 'var(--mono)',
              fontSize: 11,
            }}
          >
            {rep.verdict.criteria.map((c, i) => {
              const color =
                c.verdict === 'pass'
                  ? 'var(--green)'
                  : c.verdict === 'borderline'
                    ? 'var(--accent)'
                    : 'var(--red)';
              const icon =
                c.verdict === 'pass'
                  ? '✓'
                  : c.verdict === 'borderline'
                    ? '~'
                    : '✕';
              return (
                <span key={i} style={{ display: 'contents' }}>
                  <span style={{ color, fontWeight: 700 }}>{icon}</span>
                  <span style={{ color: 'var(--text)' }}>{c.message}</span>
                  <span style={{ color: 'var(--text-dim)' }}>
                    {c.measured.toFixed(1)}
                    {c.unit} / thr {c.threshold.toFixed(1)}
                    {c.unit}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

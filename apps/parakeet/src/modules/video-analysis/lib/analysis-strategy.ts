import type {
  BarPathPoint,
  FormFault,
  RepAnalysis,
  RepVerdict,
} from '@parakeet/shared-types';

import {
  computeBarDrift,
  extractBarPath,
  sliceBarPath,
  smoothBarPath,
} from './bar-path';
import { gradeRep } from './competition-grader';
import { detectFaults, findBottomFrame } from './fault-detector';
import type { PoseFrame } from './pose-types';
// ── Built-in Strategies ──────────────────────────────────────────────────────

// Lazy-loaded to avoid circular imports — each strategy file imports from
// the specific lib module it wraps.

import { detectReps } from './rep-detector';

/**
 * Analysis strategy interface — defines the pluggable algorithms used
 * by assembleAnalysis. Swap implementations to compare algorithms from
 * different research papers without changing the pipeline orchestration.
 *
 * Usage:
 *   import { STRATEGIES } from './analysis-strategy';
 *   assembleAnalysis({ frames, fps, lift, strategy: 'v1_mediapipe' });
 *
 * To add a new strategy:
 *   1. Implement the AnalysisStrategy interface in a new file
 *   2. Register it in STRATEGIES below
 *   3. Call assembleAnalysis with your strategy name
 *   4. For A/B comparison, call assembleAnalysis twice with different strategies
 */

// ── Rep Detection ────────────────────────────────────────────────────────────

export interface RepBounds {
  startFrame: number;
  endFrame: number;
}

export interface RepDetector {
  detectReps(params: {
    frames: PoseFrame[];
    lift: 'squat' | 'bench' | 'deadlift';
    fps: number;
    /**
     * Stage 2 output (see `spec-pipeline.md`). Only front-bench changes
     * behaviour on this input today; other detectors ignore it. Optional so
     * legacy synthetic tests that don't pass it still compile.
     */
    sagittalConfidence?: number;
  }): RepBounds[];
}

// ── Bar Path ─────────────────────────────────────────────────────────────────

export type { BarPathPoint };

export interface BarPathExtractor {
  extractBarPath(params: { frames: PoseFrame[] }): BarPathPoint[];
  smoothBarPath(params: { path: BarPathPoint[]; fps: number }): BarPathPoint[];
  computeBarDrift(params: { path: BarPathPoint[] }): number;
  sliceBarPath(params: {
    barPath: BarPathPoint[];
    startFrame: number;
    endFrame: number;
  }): BarPathPoint[];
}

// ── Fault Detection ──────────────────────────────────────────────────────────

export interface FaultDetector {
  detectFaults(params: {
    frames: PoseFrame[];
    repBounds: RepBounds;
    barPath: BarPathPoint[];
    lift: 'squat' | 'bench' | 'deadlift';
    repContext: {
      repPath: BarPathPoint[];
      barDrift: number;
      bottomFrame: number;
    };
    sagittalConfidence?: number;
  }): FormFault[];
  findBottomFrame(params: {
    frames: PoseFrame[];
    startFrame: number;
    endFrame: number;
  }): number;
}

// ── Competition Grading ──────────────────────────────────────────────────────

export interface RepGrader {
  gradeRep(params: {
    rep: RepAnalysis;
    frames: PoseFrame[];
    fps: number;
    lift: 'squat' | 'bench' | 'deadlift';
  }): RepVerdict;
}

// ── Composite Strategy ───────────────────────────────────────────────────────

export interface AnalysisStrategy {
  name: string;
  repDetector: RepDetector;
  barPath: BarPathExtractor;
  faults: FaultDetector;
  grader: RepGrader;
}

const v1MediaPipe: AnalysisStrategy = {
  name: 'v1_mediapipe',
  repDetector: { detectReps },
  barPath: { extractBarPath, smoothBarPath, computeBarDrift, sliceBarPath },
  faults: { detectFaults, findBottomFrame },
  grader: { gradeRep },
};

/**
 * Strategy registry. Add new strategies here.
 *
 * Example future entries:
 *   v2_learned: { ... }     // from paper 2202.14019 (self-supervised form reps)
 *   v3_vlm: { ... }         // VLM-based direct coaching (FormCoach pattern)
 */
export const STRATEGIES = {
  v1_mediapipe: v1MediaPipe,
} as const;

export type StrategyName = keyof typeof STRATEGIES;

export const DEFAULT_STRATEGY: StrategyName = 'v1_mediapipe';

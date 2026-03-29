import { z } from 'zod';

export const BarPathPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  frame: z.number().int(),
});

export type BarPathPoint = z.infer<typeof BarPathPointSchema>;

export const FormFaultSchema = z.object({
  type: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string(),
  value: z.number().optional(),
  threshold: z.number().optional(),
});

export type FormFault = z.infer<typeof FormFaultSchema>;

export const RepAnalysisSchema = z.object({
  repNumber: z.number().int(),
  startFrame: z.number().int(),
  endFrame: z.number().int(),
  barPath: z.array(BarPathPointSchema),
  maxDepthCm: z.number().optional(),
  forwardLeanDeg: z.number().optional(),
  barDriftCm: z.number().optional(),
  romCm: z.number().optional(),
  faults: z.array(FormFaultSchema),
});

export type RepAnalysis = z.infer<typeof RepAnalysisSchema>;

export const VideoAnalysisResultSchema = z.object({
  reps: z.array(RepAnalysisSchema),
  fps: z.number(),
  cameraAngle: z.enum(['side', 'front']),
  analysisVersion: z.number().int(),
});

export type VideoAnalysisResult = z.infer<typeof VideoAnalysisResultSchema>;

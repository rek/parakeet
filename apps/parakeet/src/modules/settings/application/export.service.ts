import { weightGramsToKg } from '@shared/utils/weight';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { fetchCompletedSessionsForExport } from '../data/export.repository';

interface ExportSet {
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe?: number;
}

interface ExportSession {
  date: string;
  lift: string;
  intensity_type: string;
  completed_at: string;
  session_rpe?: number;
  sets: ExportSet[];
  auxiliary_sets?: unknown;
}

interface ExportPayload {
  exported_at: string;
  version: 1;
  sessions: ExportSession[];
}

export async function exportTrainingData(userId: string): Promise<void> {
  const rows = await fetchCompletedSessionsForExport(userId);

  const sessions: ExportSession[] = rows.flatMap((row) =>
    row.session_logs.map((log) => {
      const sets: ExportSet[] = log.actual_sets.map((s) => ({
        set_number: s.set_number,
        weight_kg: weightGramsToKg(s.weight_grams),
        reps: s.reps_completed,
        ...(s.rpe_actual != null ? { rpe: s.rpe_actual } : {}),
      }));

      return {
        date: row.planned_date ?? row.completed_at?.split('T')[0] ?? '',
        lift: row.primary_lift ?? '',
        intensity_type: row.intensity_type ?? '',
        completed_at: row.completed_at ?? '',
        ...(log.session_rpe != null ? { session_rpe: log.session_rpe } : {}),
        sets,
        ...(log.auxiliary_sets.length > 0
          ? { auxiliary_sets: log.auxiliary_sets }
          : {}),
      };
    })
  );

  const payload: ExportPayload = {
    exported_at: new Date().toISOString(),
    version: 1,
    sessions,
  };

  const dateStr = new Date().toISOString().split('T')[0];
  const file = new File(Paths.cache, `parakeet-export-${dateStr}.json`);
  file.write(JSON.stringify(payload, null, 2));

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export Training Data',
    UTI: 'public.json',
  });
}

import { existsSync, readFileSync } from 'node:fs';

interface ThresholdBaseline {
  timestamp: string;
  scenarios: Record<string, { errors: number; warnings: number }>;
}

export function compareWithBaseline({
  baselinePath,
  currentReports,
}: {
  baselinePath: string;
  currentReports: Array<{
    scenarioKey: string;
    errors: number;
    warnings: number;
  }>;
}) {
  if (!existsSync(baselinePath)) {
    return { regressions: [], baselineExists: false };
  }

  const baseline: ThresholdBaseline = JSON.parse(
    readFileSync(baselinePath, 'utf-8')
  );
  const regressions: Array<{
    scenario: string;
    metric: 'errors' | 'warnings';
    baseline: number;
    current: number;
  }> = [];

  for (const report of currentReports) {
    const base = baseline.scenarios[report.scenarioKey];
    if (!base) continue;

    if (report.errors > base.errors) {
      regressions.push({
        scenario: report.scenarioKey,
        metric: 'errors',
        baseline: base.errors,
        current: report.errors,
      });
    }
    if (report.warnings > base.warnings) {
      regressions.push({
        scenario: report.scenarioKey,
        metric: 'warnings',
        baseline: base.warnings,
        current: report.warnings,
      });
    }
  }

  return { regressions, baselineExists: true };
}

export function generateBaseline({
  reports,
}: {
  reports: Array<{ scenarioKey: string; errors: number; warnings: number }>;
}): ThresholdBaseline {
  const scenarios: ThresholdBaseline['scenarios'] = {};
  for (const r of reports) {
    scenarios[r.scenarioKey] = { errors: r.errors, warnings: r.warnings };
  }
  return { timestamp: new Date().toISOString(), scenarios };
}

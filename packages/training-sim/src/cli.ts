import { writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ADAM,
  BUSY_BEE,
  ELITE_EVA,
  INJURED_IVAN,
  JUNIOR_JAKE,
  LISA,
  SARAH,
} from './personas';
import {
  ADHERENT_MODEL,
  BEGINNER_MODEL,
  FATIGUED_MODEL,
  STRUGGLING_MODEL,
} from './personas/performance-models';
import { formatReport, formatReportJson, generateReport } from './reporter';
import {
  ADHERENT_FEMALE,
  ADHERENT_MALE,
  BUSY_SCRIPT,
  ELITE_FEMALE,
  INJURED_SCRIPT,
  JUNIOR_MALE,
  STABLE_FEMALE,
} from './scripts';
import { FAILED_SETS_SCRIPT } from './scripts/failed-sets';
import {
  FATIGUE_ACCUMULATION_SCRIPT,
  ILLNESS_SCRIPT,
  NO_EQUIPMENT_SCRIPT,
} from './scripts/illness';
import {
  COMPETITION_PREP_SCRIPT,
  PEAKING_SCRIPT,
  RETURN_FROM_LAYOFF_SCRIPT,
} from './scripts/competition';
import { runSimulation } from './simulator';
import { SimulationReport } from './types';
import { compareWithBaseline, generateBaseline } from './threshold';

const jsonOutput = process.argv.includes('--json');

const scenarios = [
  // Core scenarios
  { persona: ADAM, script: ADHERENT_MALE, model: ADHERENT_MODEL },
  { persona: LISA, script: ADHERENT_FEMALE, model: ADHERENT_MODEL },
  { persona: INJURED_IVAN, script: INJURED_SCRIPT, model: FATIGUED_MODEL },
  { persona: BUSY_BEE, script: BUSY_SCRIPT, model: BEGINNER_MODEL },
  { persona: SARAH, script: STABLE_FEMALE, model: ADHERENT_MODEL },
  { persona: JUNIOR_JAKE, script: JUNIOR_MALE, model: BEGINNER_MODEL },
  { persona: ELITE_EVA, script: ELITE_FEMALE, model: ADHERENT_MODEL },
  // Extended scenarios
  { persona: ADAM, script: ILLNESS_SCRIPT, model: ADHERENT_MODEL },
  { persona: LISA, script: NO_EQUIPMENT_SCRIPT, model: ADHERENT_MODEL },
  { persona: ADAM, script: FATIGUE_ACCUMULATION_SCRIPT, model: FATIGUED_MODEL },
  // Set failure scenarios
  { persona: ADAM, script: FAILED_SETS_SCRIPT, model: STRUGGLING_MODEL },
  // Competition scenarios
  { persona: ADAM, script: PEAKING_SCRIPT, model: ADHERENT_MODEL },
  { persona: SARAH, script: COMPETITION_PREP_SCRIPT, model: ADHERENT_MODEL },
  { persona: INJURED_IVAN, script: RETURN_FROM_LAYOFF_SCRIPT, model: FATIGUED_MODEL },
];

const reports: SimulationReport[] = [];
let allPassed = true;

for (const { persona, script, model } of scenarios) {
  if (!jsonOutput) {
    console.log(`\nRunning: ${persona.name} × ${script.name}...`);
  }

  const log = runSimulation({ persona, script, performanceModel: model });
  const report = generateReport(log);
  reports.push(report);

  if (!jsonOutput) {
    console.log(formatReport(report));
  }

  if (!report.summary.passed) {
    allPassed = false;
  }
}

if (jsonOutput) {
  const jsonReports = reports.map((r) => JSON.parse(formatReportJson(r)));
  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalScenarios: scenarios.length,
        passed: allPassed,
        reports: jsonReports,
      },
      null,
      2
    )
  );
} else {
  console.log('\n' + '='.repeat(60));
  console.log(`${reports.length} scenarios run`);
  const passed = reports.filter((r) => r.summary.passed).length;
  const failed = reports.filter((r) => !r.summary.passed).length;
  console.log(`  ${passed} passed, ${failed} failed`);

  if (allPassed) {
    console.log('ALL SIMULATIONS PASSED');
  } else {
    console.log('SOME SIMULATIONS FAILED');
  }
}

// JSON artifact output
const outputPath = process.argv
  .find((a) => a.startsWith('--output='))
  ?.split('=')[1];
if (outputPath) {
  const jsonReports = reports.map((r) => JSON.parse(formatReportJson(r)));
  const output = JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      totalScenarios: scenarios.length,
      passed: allPassed,
      reports: jsonReports,
    },
    null,
    2
  );
  writeFileSync(outputPath, output);
  console.log(`JSON artifact written to ${outputPath}`);
}

// Threshold comparison
const baselinePath = path.join(__dirname, '..', 'baseline.json');
const currentThresholds = reports.map((r, i) => ({
  scenarioKey: `${scenarios[i].persona.name} × ${scenarios[i].script.name}`,
  errors: r.summary.errors,
  warnings: r.summary.warnings,
}));

const { regressions, baselineExists } = compareWithBaseline({
  baselinePath,
  currentReports: currentThresholds,
});

if (baselineExists && regressions.length > 0) {
  console.log('\n⚠️  THRESHOLD REGRESSIONS:');
  for (const r of regressions) {
    console.log(
      `  ${r.scenario}: ${r.metric} increased from ${r.baseline} to ${r.current}`
    );
  }
}

if (process.argv.includes('--update-baseline')) {
  const baseline = generateBaseline({ reports: currentThresholds });
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
  console.log('Baseline updated.');
}

if (!allPassed && !jsonOutput) {
  process.exit(1);
}

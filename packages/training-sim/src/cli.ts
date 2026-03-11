import { runSimulation } from './simulator'
import { generateReport, formatReport, formatReportJson } from './reporter'
import { ADAM, LISA, INJURED_IVAN, BUSY_BEE, SARAH, JUNIOR_JAKE, ELITE_EVA } from './personas'
import { ADHERENT_MALE, ADHERENT_FEMALE, STABLE_FEMALE, JUNIOR_MALE, ELITE_FEMALE, INJURED_SCRIPT, BUSY_SCRIPT } from './scripts'
import { ILLNESS_SCRIPT, NO_EQUIPMENT_SCRIPT, FATIGUE_ACCUMULATION_SCRIPT } from './scripts/illness'
import { FAILED_SETS_SCRIPT } from './scripts/failed-sets'
import { ADHERENT_MODEL, BEGINNER_MODEL, FATIGUED_MODEL, STRUGGLING_MODEL } from './personas/performance-models'
import { SimulationReport } from './types'

const jsonOutput = process.argv.includes('--json')

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
]

const reports: SimulationReport[] = []
let allPassed = true

for (const { persona, script, model } of scenarios) {
  if (!jsonOutput) {
    console.log(`\nRunning: ${persona.name} × ${script.name}...`)
  }

  const log = runSimulation({ persona, script, performanceModel: model })
  const report = generateReport(log)
  reports.push(report)

  if (!jsonOutput) {
    console.log(formatReport(report))
  }

  if (!report.summary.passed) {
    allPassed = false
  }
}

if (jsonOutput) {
  const jsonReports = reports.map((r) => JSON.parse(formatReportJson(r)))
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    totalScenarios: scenarios.length,
    passed: allPassed,
    reports: jsonReports,
  }, null, 2))
} else {
  console.log('\n' + '='.repeat(60))
  console.log(`${reports.length} scenarios run`)
  const passed = reports.filter((r) => r.summary.passed).length
  const failed = reports.filter((r) => !r.summary.passed).length
  console.log(`  ${passed} passed, ${failed} failed`)

  if (allPassed) {
    console.log('ALL SIMULATIONS PASSED')
  } else {
    console.log('SOME SIMULATIONS FAILED')
    process.exit(1)
  }
}

if (!allPassed && !jsonOutput) {
  process.exit(1)
}

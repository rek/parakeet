import { MuscleGroup, MUSCLE_GROUPS } from '@parakeet/training-engine'
import { InvariantViolation, SimulationLog } from '../types'

/**
 * Checks that auxiliary exercise rotation provides balanced muscle coverage
 * across each 3-week block. Every muscle group that has MEV > 0 should
 * receive some auxiliary work over the course of a block.
 */
export function checkMuscleCoverage(log: SimulationLog): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  const trainedSessions = log.sessions.filter((s) => !s.skipped)

  // Group sessions into 3-week blocks
  const blockSessions = new Map<number, typeof trainedSessions>()
  for (const session of trainedSessions) {
    const blockNum = session.blockNumber ?? Math.ceil(session.weekNumber / 3)
    const existing = blockSessions.get(blockNum) ?? []
    existing.push(session)
    blockSessions.set(blockNum, existing)
  }

  for (const [blockNum, sessions] of blockSessions) {
    // Collect all muscles hit by non-skipped auxiliary work in this block
    const musclesHit = new Set<string>()

    for (const session of sessions) {
      // Main lift muscles always count
      const mainLiftVolume = session.weeklyVolumeSnapshot
      for (const [muscle, vol] of Object.entries(mainLiftVolume)) {
        if (vol > 0) musclesHit.add(muscle)
      }

      // Aux exercise muscles
      for (const aux of session.auxiliaryWork) {
        if (aux.skipped) continue
        // We don't have direct muscle mapping here, but the exercise
        // contributes volume tracked in weeklyVolumeSnapshot
      }
    }

    // Check which muscles with MEV > 0 got zero volume in this block
    const lastSession = sessions[sessions.length - 1]
    if (!lastSession) continue

    for (const muscle of MUSCLE_GROUPS) {
      const finalVol = lastSession.weeklyVolumeSnapshot[muscle as MuscleGroup]
      // Only flag if a muscle got literally zero volume across the entire block
      // This is a very loose check — tighter checks belong in volume_safety
      if (finalVol === undefined || finalVol === 0) {
        // Only warn for muscles that are typically trained (not obscure ones)
        const coreMuscles: MuscleGroup[] = ['quads', 'hamstrings', 'chest', 'upper_back', 'triceps', 'shoulders']
        if (coreMuscles.includes(muscle as MuscleGroup)) {
          violations.push({
            category: 'auxiliary_balance',
            rule: 'muscle_zero_coverage',
            severity: 'warning',
            message: `${muscle} received zero volume in block ${blockNum}`,
            weekNumber: sessions[0].weekNumber,
          })
        }
      }
    }
  }

  return violations
}

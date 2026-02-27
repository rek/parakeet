import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getSession, startSession } from '../../lib/sessions'
import { useSessionStore } from '../../store/sessionStore'
import { WarmupSection } from '../../components/training/WarmupSection'
import { SetRow } from '../../components/training/SetRow'
import { RestTimer } from '../../components/training/RestTimer'
import { colors } from '../../theme'

// ── Types ────────────────────────────────────────────────────────────────────

interface PlannedSet {
  weight_kg: number
  reps: number
  rpe_target?: number
  set_type?: string
}

interface WarmupSet {
  weightKg: number
  reps: number
  label?: string
}

interface AuxiliaryWork {
  exercise: string
  sets: PlannedSet[]
  skipped: boolean
  skipReason?: string
}

interface RestRecommendations {
  mainLift: number[]
  auxiliary: number[]
}

interface LlmRestSuggestion {
  deltaSeconds: number
  formulaBaseSeconds: number
}

interface JitData {
  mainLiftSets: PlannedSet[]
  warmupSets: WarmupSet[]
  auxiliaryWork: AuxiliaryWork[]
  restRecommendations?: RestRecommendations
  llmRestSuggestion?: LlmRestSuggestion | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MAIN_REST_SECONDS = 180
const DEFAULT_AUX_REST_SECONDS = 90

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatExerciseName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SessionScreen() {
  const { sessionId, jitData } = useLocalSearchParams<{
    sessionId: string
    jitData: string
  }>()

  const {
    actualSets,
    auxiliarySets,
    plannedSets,
    warmupCompleted,
    initSession,
    initAuxiliary,
    updateSet,
    updateAuxiliarySet,
    setWarmupDone,
  } = useSessionStore()

  const [warmupSets, setWarmupSets] = useState<WarmupSet[]>([])
  const [auxiliaryWork, setAuxiliaryWork] = useState<AuxiliaryWork[]>([])
  const [sessionMeta, setSessionMeta] = useState<{
    primary_lift: string
    intensity_type: string
    block_number: number | null
    week_number: number
  } | null>(null)

  // Rest timer state: which main-lift set just completed
  const [timerVisible, setTimerVisible] = useState(false)
  const [timerDuration, setTimerDuration] = useState(DEFAULT_MAIN_REST_SECONDS)
  const [timerLlmSuggestion, setTimerLlmSuggestion] = useState<
    LlmRestSuggestion | undefined
  >(undefined)
  // The set number that triggered the timer (rest is attributed to this set)
  const pendingRestSetNumber = useRef<number | null>(null)
  // For auxiliary: { exercise, setNumber } that triggered the timer
  const pendingAuxRest = useRef<{ exercise: string; setNumber: number } | null>(null)
  // Ref mirror of timerVisible so handleSetUpdate closure stays stable
  const timerVisibleRef = useRef(false)

  // Rest recommendations extracted from jit output
  const restRecommendations = useRef<RestRecommendations | null>(null)
  const llmRestSuggestion = useRef<LlmRestSuggestion | null>(null)

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId || !jitData) {
      router.back()
      return
    }

    let parsed: JitData
    try {
      parsed = JSON.parse(jitData) as JitData
    } catch {
      router.back()
      return
    }

    const { mainLiftSets, warmupSets: ws, auxiliaryWork: aux } = parsed
    setWarmupSets(ws ?? [])

    if (parsed.restRecommendations) {
      restRecommendations.current = parsed.restRecommendations
    }
    if (parsed.llmRestSuggestion) {
      llmRestSuggestion.current = parsed.llmRestSuggestion
    }

    // Initialize store synchronously so stale is_completed from a prior session
    // can never race with the user completing sets and navigating to complete screen.
    initSession(sessionId, mainLiftSets)

    const activeAux = (aux ?? []).filter((a) => !a.skipped)
    setAuxiliaryWork(aux ?? [])
    if (activeAux.length > 0) {
      initAuxiliary(activeAux.map((a) => ({ exercise: a.exercise, sets: a.sets })))
    }

    getSession(sessionId).then((session) => {
      if (!session) {
        router.back()
        return
      }
      setSessionMeta({
        primary_lift:   session.primary_lift,
        intensity_type: session.intensity_type,
        block_number:   session.block_number ?? null,
        week_number:    session.week_number,
      })
      startSession(sessionId)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSetUpdate = useCallback(
    (
      setNumber: number,
      data: { weightKg: number; reps: number; rpe?: number; isCompleted: boolean },
    ) => {
      updateSet(setNumber, {
        weight_grams:   Math.round(data.weightKg * 1000),
        reps_completed: data.reps,
        rpe_actual:     data.rpe,
        is_completed:   data.isCompleted,
      })

      // When a set transitions to completed, open the rest timer.
      // If timer is already visible (user completed a set while resting),
      // dismiss it quietly before launching the new one.
      if (data.isCompleted) {
        if (timerVisibleRef.current) {
          timerVisibleRef.current = false
          setTimerVisible(false)
        }

        // No rest timer after the last set
        if (setNumber >= plannedSets.length) return

        const setIndex = setNumber - 1
        const duration =
          restRecommendations.current?.mainLift[setIndex] ??
          DEFAULT_MAIN_REST_SECONDS

        pendingRestSetNumber.current = setNumber
        pendingAuxRest.current = null
        setTimerDuration(duration)
        setTimerLlmSuggestion(llmRestSuggestion.current ?? undefined)
        timerVisibleRef.current = true
        setTimerVisible(true)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateSet],
  )

  const handleAuxSetUpdate = useCallback(
    (
      exerciseIndex: number,
      exercise: string,
      setNumber: number,
      setsInExercise: number,
      data: { weightKg: number; reps: number; rpe?: number; isCompleted: boolean },
    ) => {
      updateAuxiliarySet(exercise, setNumber, {
        weight_grams:   Math.round(data.weightKg * 1000),
        reps_completed: data.reps,
        rpe_actual:     data.rpe,
        is_completed:   data.isCompleted,
      })

      if (data.isCompleted) {
        if (timerVisibleRef.current) {
          timerVisibleRef.current = false
          setTimerVisible(false)
        }

        // No rest timer after the last set of this exercise
        if (setNumber >= setsInExercise) return

        const duration =
          restRecommendations.current?.auxiliary[exerciseIndex] ??
          DEFAULT_AUX_REST_SECONDS

        pendingRestSetNumber.current = null
        pendingAuxRest.current = { exercise, setNumber }
        setTimerDuration(duration)
        setTimerLlmSuggestion(undefined)
        timerVisibleRef.current = true
        setTimerVisible(true)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateAuxiliarySet],
  )

  function handleTimerDone(elapsedSeconds: number) {
    if (pendingRestSetNumber.current !== null) {
      updateSet(pendingRestSetNumber.current, {
        actual_rest_seconds: elapsedSeconds,
      })
      pendingRestSetNumber.current = null
    } else if (pendingAuxRest.current !== null) {
      const { exercise, setNumber } = pendingAuxRest.current
      updateAuxiliarySet(exercise, setNumber, {
        actual_rest_seconds: elapsedSeconds,
      })
      pendingAuxRest.current = null
    }
    timerVisibleRef.current = false
    setTimerVisible(false)
  }

  function handleComplete() {
    if (timerVisibleRef.current) {
      timerVisibleRef.current = false
      setTimerVisible(false)
    }
    router.push({
      pathname: '/session/complete',
      params: { sessionId },
    })
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasCompletedSet = actualSets.some((s) => s.is_completed)

  const liftHeader = sessionMeta
    ? `${capitalize(sessionMeta.primary_lift)} — ${capitalize(sessionMeta.intensity_type)}`
    : ''

  const blockWeekLabel = sessionMeta
    ? sessionMeta.block_number !== null
      ? `Block ${sessionMeta.block_number} · Week ${sessionMeta.week_number}`
      : `Week ${sessionMeta.week_number}`
    : ''

  // Label passed to RestTimer: "Block 3 · Heavy" style
  const intensityLabel = sessionMeta
    ? sessionMeta.block_number !== null
      ? `Block ${sessionMeta.block_number} · ${capitalize(sessionMeta.intensity_type)}`
      : capitalize(sessionMeta.intensity_type)
    : ''

  // Group auxiliary sets by exercise for rendering
  const auxByExercise = auxiliaryWork.map((aw) => ({
    ...aw,
    actualSets: auxiliarySets.filter((s) => s.exercise === aw.exercise),
  }))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Session header */}
        <View style={styles.sessionHeader}>
          <Text style={styles.liftTitle}>{liftHeader}</Text>
          <Text style={styles.blockWeekText}>{blockWeekLabel}</Text>
        </View>

        {/* Warmup section */}
        {warmupSets.length > 0 && (
          <WarmupSection
            sets={warmupSets}
            completedIndices={warmupCompleted}
            onToggle={setWarmupDone}
          />
        )}

        {/* Working sets header */}
        <View style={styles.workingSetsHeader}>
          <Text style={styles.workingSetsTitle}>Working Sets</Text>
        </View>

        {/* Set rows */}
        {actualSets.map((actualSet, index) => {
          const planned = plannedSets[index]
          return (
            <SetRow
              key={actualSet.set_number}
              setNumber={actualSet.set_number}
              plannedWeightKg={planned?.weight_kg ?? actualSet.weight_grams / 1000}
              plannedReps={planned?.reps ?? actualSet.reps_completed}
              onUpdate={(data) => handleSetUpdate(actualSet.set_number, data)}
            />
          )
        })}

        {/* Auxiliary work section */}
        {auxiliaryWork.length > 0 && (
          <View style={styles.auxSection}>
            <View style={styles.workingSetsHeader}>
              <Text style={styles.workingSetsTitle}>Auxiliary Work</Text>
            </View>

            {auxByExercise.map((aw, exerciseIndex) => (
              <View key={aw.exercise} style={styles.auxExercise}>
                <Text style={styles.auxExerciseName}>
                  {formatExerciseName(aw.exercise)}
                </Text>

                {aw.skipped ? (
                  <Text style={styles.auxSkippedText}>
                    Skipped{aw.skipReason ? ` — ${aw.skipReason}` : ''}
                  </Text>
                ) : (
                  aw.actualSets.map((actualSet) => {
                    const planned = aw.sets[actualSet.set_number - 1]
                    return (
                      <SetRow
                        key={`${aw.exercise}-${actualSet.set_number}`}
                        setNumber={actualSet.set_number}
                        plannedWeightKg={planned?.weight_kg ?? actualSet.weight_grams / 1000}
                        plannedReps={planned?.reps ?? actualSet.reps_completed}
                        onUpdate={(data) =>
                          handleAuxSetUpdate(
                            exerciseIndex,
                            aw.exercise,
                            actualSet.set_number,
                            aw.sets.length,
                            data,
                          )
                        }
                      />
                    )
                  })
                )}
              </View>
            ))}
          </View>
        )}

        {/* Bottom padding for sticky button */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Sticky complete button */}
      <View style={styles.stickyFooter}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            !hasCompletedSet && styles.completeButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={!hasCompletedSet}
          activeOpacity={0.8}
        >
          <Text style={styles.completeButtonText}>Complete Workout</Text>
        </TouchableOpacity>
      </View>

      {/* Rest timer modal */}
      <Modal
        visible={timerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => handleTimerDone(0)}
      >
        <View style={styles.modalOverlay}>
          <RestTimer
            durationSeconds={timerDuration}
            llmSuggestion={timerLlmSuggestion}
            onDone={handleTimerDone}
            intensityLabel={intensityLabel}
          />
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgSurface,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingBottom: 16,
  },
  sessionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  liftTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  blockWeekText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  workingSetsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  workingSetsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  auxSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  auxExercise: {
    marginBottom: 8,
  },
  auxExerciseName: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  auxSkippedText: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: 100,
  },
  stickyFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  completeButtonDisabled: {
    opacity: 0.4,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlayLight,
  },
})

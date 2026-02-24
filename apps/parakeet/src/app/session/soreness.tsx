import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/sessions'
import { runJITForSession } from '../../lib/jit'
import { useAuth } from '../../hooks/useAuth'

// ── Types ────────────────────────────────────────────────────────────────────

type Session = Awaited<ReturnType<typeof getSession>>

// ── Constants ────────────────────────────────────────────────────────────────

const LIFT_MUSCLES: Record<string, string[]> = {
  squat:    ['quads', 'glutes', 'lower_back'],
  bench:    ['chest', 'triceps', 'shoulders'],
  deadlift: ['hamstrings', 'glutes', 'lower_back'],
}

const MUSCLE_LABELS: Record<string, string> = {
  quads:      'Quads',
  glutes:     'Glutes',
  lower_back: 'Lower Back',
  chest:      'Chest',
  triceps:    'Triceps',
  shoulders:  'Shoulders',
  hamstrings: 'Hamstrings',
}

const RATING_LEVELS = [1, 2, 3, 4, 5] as const

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// ── Sub-component: single muscle rating row ───────────────────────────────

interface MuscleRatingRowProps {
  muscle: string
  rating: number
  onChange: (muscle: string, rating: number) => void
}

function MuscleRatingRow({ muscle, rating, onChange }: MuscleRatingRowProps) {
  const label = MUSCLE_LABELS[muscle] ?? capitalize(muscle.replace(/_/g, ' '))

  return (
    <View style={styles.muscleRow}>
      <Text style={styles.muscleLabel}>{label}</Text>
      <View style={styles.ratingPills}>
        {RATING_LEVELS.map((level) => {
          const isActive = rating === level
          return (
            <TouchableOpacity
              key={level}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => onChange(muscle, level)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {level}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SorenessScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { user } = useAuth()

  const [session, setSession] = useState<Session>(null)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [generating, setGenerating] = useState(false)

  const muscles = session
    ? (LIFT_MUSCLES[session.primary_lift] ?? [])
    : []

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId) return
    getSession(sessionId).then((data) => {
      setSession(data)
      // Initialise all relevant muscles to 1 (fresh)
      if (data?.primary_lift) {
        const initialRatings: Record<string, number> = {}
        for (const muscle of LIFT_MUSCLES[data.primary_lift] ?? []) {
          initialRatings[muscle] = 1
        }
        setRatings(initialRatings)
      }
    })
  }, [sessionId])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function handleRatingChange(muscle: string, rating: number) {
    setRatings((prev) => ({ ...prev, [muscle]: rating }))
  }

  function allFreshRatings(): Record<string, number> {
    const fresh: Record<string, number> = {}
    for (const muscle of muscles) {
      fresh[muscle] = 1
    }
    return fresh
  }

  async function runJIT(ratingsToUse: Record<string, number>) {
    if (!session || !user) return
    setGenerating(true)
    try {
      const jitOutput = await runJITForSession(session, user.id, ratingsToUse as any)
      router.replace({
        pathname: '/session/[sessionId]',
        params: {
          sessionId: session.id,
          jitData: JSON.stringify({
            mainLiftSets:  jitOutput.mainLiftSets,
            warmupSets:    jitOutput.warmupSets,
            auxiliaryWork: jitOutput.auxiliaryWork,
          }),
        },
      })
    } catch (err: unknown) {
      Alert.alert(
        'Generation failed',
        err instanceof Error ? err.message : 'Unable to generate workout — try again.',
      )
      setGenerating(false)
    }
  }

  async function handleGenerate() {
    if (!session || !user) return
    try {
      await supabase.from('soreness_checkins').insert({
        session_id:  sessionId,
        user_id:     user.id,
        ratings,
        skipped:     false,
        recorded_at: new Date().toISOString(),
      })
    } catch {
      // Non-critical — proceed even if the insert fails
    }
    await runJIT(ratings)
  }

  async function handleSkip() {
    if (!session || !user) return
    const freshRatings = allFreshRatings()
    setRatings(freshRatings)
    try {
      await supabase.from('soreness_checkins').insert({
        session_id:  sessionId,
        user_id:     user.id,
        ratings:     freshRatings,
        skipped:     true,
        recorded_at: new Date().toISOString(),
      })
    } catch {
      // Non-critical
    }
    await runJIT(freshRatings)
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasSevereSoreness = Object.values(ratings).some((r) => r === 5)
  const liftLabel = session
    ? `${capitalize(session.primary_lift)} — ${capitalize(session.intensity_type)}`
    : 'Loading...'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Custom header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerBack}>
          <Text style={styles.headerBackText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{liftLabel}</Text>
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.headerSkip}>
          <Text style={styles.headerSkipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.prompt}>How are these muscles feeling today?</Text>

        {/* Muscle rating rows */}
        {muscles.map((muscle) => (
          <MuscleRatingRow
            key={muscle}
            muscle={muscle}
            rating={ratings[muscle] ?? 1}
            onChange={handleRatingChange}
          />
        ))}

        {/* Rating legend */}
        <Text style={styles.legend}>1=Fresh  2=Mild  3=Moderate  4=High  5=Severe</Text>

        {/* Severe soreness warning */}
        {hasSevereSoreness && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              Severe soreness detected — recovery session at 40% intensity
            </Text>
          </View>
        )}

        {/* Generate button */}
        <TouchableOpacity
          style={[styles.generateButton, (!session || generating) && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={!session || generating}
          activeOpacity={0.8}
        >
          <Text style={styles.generateButtonText}>Generate Today's Workout →</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Generating overlay */}
      {generating && (
        <View style={styles.generatingOverlay}>
          <View style={styles.generatingCard}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.generatingText}>Generating your workout...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerBack: {
    minWidth: 48,
  },
  headerBackText: {
    fontSize: 16,
    color: '#4F46E5',
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSkip: {
    minWidth: 48,
    alignItems: 'flex-end',
  },
  headerSkipText: {
    fontSize: 16,
    color: '#4F46E5',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  prompt: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 24,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  muscleLabel: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  ratingPills: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: '#4F46E5',
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  pillTextActive: {
    color: '#fff',
  },
  legend: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  warningCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  generateButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.4,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  generatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 16,
  },
  generatingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
})

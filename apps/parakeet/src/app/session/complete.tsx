import { useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'

import { completeSession } from '../../lib/sessions'
import { useSessionStore } from '../../store/sessionStore'
import { useAuth } from '../../hooks/useAuth'

// ── Constants ────────────────────────────────────────────────────────────────

const RPE_OPTIONS = [6, 7, 8, 9, 10] as const

// ── Screen ───────────────────────────────────────────────────────────────────

export default function CompleteScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const {
    sessionId,
    actualSets,
    sessionRpe,
    startedAt,
    plannedSets,
    setSessionRpe,
    reset,
  } = useSessionStore()

  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Derived stats ─────────────────────────────────────────────────────────

  const totalSets = actualSets.length
  const completedSets = actualSets.filter((s) => s.is_completed).length
  const completionPct =
    totalSets > 0
      ? ((completedSets / totalSets) * 100).toFixed(0)
      : '0'

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSaveAndFinish() {
    if (!sessionId || !user) {
      Alert.alert('Error', 'Session data is missing — please restart the app.')
      return
    }

    setSaving(true)
    try {
      await completeSession(sessionId, user.id, {
        actualSets: actualSets.map((s) => ({
          set_number:    s.set_number,
          weight_grams:  s.weight_grams,
          reps_completed: s.reps_completed,
          rpe_actual:    s.rpe_actual,
          notes:         notes.trim() || undefined,
        })),
        sessionRpe,
        startedAt,
      })

      reset()
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      await queryClient.invalidateQueries({ queryKey: ['today'] })
      router.replace('/(tabs)/today')
    } catch (err: unknown) {
      Alert.alert(
        'Could not save workout',
        err instanceof Error ? err.message : 'An error occurred — please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Text style={styles.title}>Workout Complete 🎉</Text>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Completion</Text>
            <Text style={styles.statValue}>{completionPct}%</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Sets completed</Text>
            <Text style={styles.statValue}>{completedSets}/{totalSets}</Text>
          </View>
          {plannedSets.length > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Sets planned</Text>
                <Text style={styles.statValue}>{plannedSets.length}</Text>
              </View>
            </>
          )}
        </View>

        {/* Session RPE */}
        <Text style={styles.sectionLabel}>Overall Session RPE</Text>
        <View style={styles.rpeRow}>
          {RPE_OPTIONS.map((level) => {
            const isActive = sessionRpe === level
            return (
              <TouchableOpacity
                key={level}
                style={[styles.rpePill, isActive && styles.rpePillActive]}
                onPress={() => setSessionRpe(level)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rpePillText, isActive && styles.rpePillTextActive]}>
                  {level}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Notes */}
        <Text style={styles.sectionLabel}>Session Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="How did it feel? Any issues?"
          placeholderTextColor="#9CA3AF"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          returnKeyType="default"
        />

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveAndFinish}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save & Finish'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 24,
    textAlign: 'center',
  },
  statsCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 32,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  statLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  rpeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  rpePill: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpePillActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  rpePillText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  rpePillTextActive: {
    color: '#fff',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
    minHeight: 100,
    marginBottom: 32,
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})

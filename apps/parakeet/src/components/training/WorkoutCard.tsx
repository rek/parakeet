import { router } from 'expo-router'
import { useState } from 'react'
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { skipSession } from '../../lib/sessions'

interface ActiveDisruption {
  id: string
  disruption_type: string
  severity: string
  affected_lifts: string[] | null
  description: string | null
}

interface WorkoutCardProps {
  session: {
    id: string
    primary_lift: string
    intensity_type: string
    block_number: number | null
    week_number: number
    planned_date: string
    planned_sets: unknown[] | null
    status: string
  }
  activeDisruptions?: ActiveDisruption[]
  onSkipComplete?: () => void
}

const INTENSITY_BADGE_COLORS: Record<string, string> = {
  heavy:     '#EF4444',
  explosive: '#3B82F6',
  rep:       '#10B981',
}

function getIntensityBadgeColor(intensityType: string): string {
  const key = intensityType.toLowerCase()
  return INTENSITY_BADGE_COLORS[key] ?? '#6B7280'
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AU', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function isDisruptionRelevant(
  disruption: ActiveDisruption,
  primaryLift: string,
): boolean {
  return (
    disruption.affected_lifts === null ||
    disruption.affected_lifts.includes(primaryLift)
  )
}

export function WorkoutCard({
  session,
  activeDisruptions = [],
  onSkipComplete,
}: WorkoutCardProps) {
  const [skipModalVisible, setSkipModalVisible] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [isSkipping, setIsSkipping] = useState(false)

  const relevantDisruptions = activeDisruptions.filter((d) =>
    isDisruptionRelevant(d, session.primary_lift),
  )

  function handleStartWorkout() {
    router.push({
      pathname: '/session/soreness',
      params: { sessionId: session.id },
    })
  }

  function handleSkipPress() {
    setSkipReason('')
    setSkipModalVisible(true)
  }

  async function handleConfirmSkip() {
    if (isSkipping) return
    setIsSkipping(true)
    try {
      await skipSession(session.id, skipReason.trim() || undefined)
      setSkipModalVisible(false)
      onSkipComplete?.()
    } finally {
      setIsSkipping(false)
    }
  }

  function handleCancelSkip() {
    setSkipModalVisible(false)
    setSkipReason('')
  }

  const badgeColor = getIntensityBadgeColor(session.intensity_type)
  const blockLabel =
    session.block_number !== null
      ? `Block ${session.block_number} · Week ${session.week_number}`
      : `Week ${session.week_number}`

  return (
    <View>
      {relevantDisruptions.map((disruption) => (
        <View key={disruption.id} style={styles.disruptionBanner}>
          <Text style={styles.disruptionText}>
            Active disruption:{' '}
            {disruption.disruption_type.replace(/_/g, ' ')} ({disruption.severity}) — load may
            be adjusted
          </Text>
        </View>
      ))}

      <View style={styles.card}>
        {/* Lift name + intensity badge */}
        <View style={styles.cardHeader}>
          <Text style={styles.liftName}>
            {session.primary_lift.charAt(0).toUpperCase() +
              session.primary_lift.slice(1)}
          </Text>
          <View style={[styles.intensityBadge, { backgroundColor: badgeColor }]}>
            <Text style={styles.intensityBadgeText}>
              {session.intensity_type.charAt(0).toUpperCase() +
                session.intensity_type.slice(1)}
            </Text>
          </View>
        </View>

        {/* Block / week */}
        <Text style={styles.blockWeekText}>{blockLabel}</Text>

        {/* Sets info */}
        {session.planned_sets === null ? (
          <Text style={styles.noSetsText}>
            Workout generated when you start
          </Text>
        ) : (
          <Text style={styles.setsText}>{session.planned_sets.length} sets</Text>
        )}

        {/* Planned date */}
        <Text style={styles.dateText}>{formatDate(session.planned_date)}</Text>

        {/* Action buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={handleStartWorkout}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.skipButton]}
            onPress={handleSkipPress}
            activeOpacity={0.8}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Skip Modal */}
      <Modal
        visible={skipModalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCancelSkip}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Skip this session?</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Reason (optional)"
              placeholderTextColor="#9CA3AF"
              value={skipReason}
              onChangeText={setSkipReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.skipConfirmButton,
                isSkipping && styles.modalButtonDisabled,
              ]}
              onPress={handleConfirmSkip}
              disabled={isSkipping}
              activeOpacity={0.8}
            >
              <Text style={styles.skipConfirmButtonText}>
                {isSkipping ? 'Skipping…' : 'Skip Session'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={handleCancelSkip}
              disabled={isSkipping}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  disruptionBanner: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 4,
  },
  disruptionText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    marginHorizontal: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  liftName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  intensityBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  intensityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  blockWeekText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  noSetsText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  setsText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 6,
  },
  dateText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4F46E5',
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  skipButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 16,
    minHeight: 72,
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  skipConfirmButton: {
    backgroundColor: '#EF4444',
  },
  skipConfirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
})

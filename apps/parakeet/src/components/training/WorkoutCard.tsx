import { router } from 'expo-router'
import { useState } from 'react'
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { skipSession } from '../../lib/sessions'
import { resolveDisruption } from '../../lib/disruptions'
import { useAuth } from '../../hooks/useAuth'
import { colors, spacing, radii, typography } from '../../theme'

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
  onDisruptionResolved?: () => void
}

const INTENSITY_BADGE: Record<string, { bg: string; text: string }> = {
  heavy:     { bg: colors.danger,    text: colors.text },
  explosive: { bg: colors.primary,   text: colors.textInverse },
  rep:       { bg: colors.success,   text: colors.textInverse },
}

function getIntensityBadge(intensityType: string) {
  return INTENSITY_BADGE[intensityType.toLowerCase()] ?? { bg: colors.bgMuted, text: colors.textSecondary }
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
  onDisruptionResolved,
}: WorkoutCardProps) {
  const { user } = useAuth()
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

  function handleDisruptionPress(disruption: ActiveDisruption) {
    Alert.alert(
      disruption.disruption_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      `Severity: ${disruption.severity}${disruption.description ? `\n${disruption.description}` : ''}`,
      [
        {
          text: 'Mark as resolved',
          onPress: async () => {
            if (!user) return
            await resolveDisruption(disruption.id, user.id)
            onDisruptionResolved?.()
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    )
  }

  const badge = getIntensityBadge(session.intensity_type)
  const blockLabel =
    session.block_number !== null
      ? `Block ${session.block_number} · Week ${session.week_number}`
      : `Week ${session.week_number}`

  return (
    <View>
      {relevantDisruptions.map((disruption) => (
        <TouchableOpacity
          key={disruption.id}
          style={styles.disruptionBanner}
          onPress={() => handleDisruptionPress(disruption)}
          activeOpacity={0.7}
        >
          <Text style={styles.disruptionText}>
            ⚡ Active disruption:{' '}
            {disruption.disruption_type.replace(/_/g, ' ')} ({disruption.severity}) — tap to resolve
          </Text>
        </TouchableOpacity>
      ))}

      <View style={styles.card}>
        {/* Lift name + intensity badge */}
        <View style={styles.cardHeader}>
          <Text style={styles.liftName}>
            {session.primary_lift.charAt(0).toUpperCase() +
              session.primary_lift.slice(1)}
          </Text>
          <View style={[styles.intensityBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.intensityBadgeText, { color: badge.text }]}>
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
            activeOpacity={0.85}
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
              placeholderTextColor={colors.textTertiary}
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
    backgroundColor: colors.secondaryMuted,
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
    borderRadius: radii.xs,
  },
  disruptionText: {
    fontSize: typography.sizes.sm,
    color: colors.secondary,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[5],
    marginHorizontal: spacing[4],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[1.5],
  },
  liftName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.black,
    color: colors.text,
    flex: 1,
    marginRight: spacing[2],
    letterSpacing: typography.letterSpacing.tight,
  },
  intensityBadge: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
  },
  intensityBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  blockWeekText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing[2],
  },
  noSetsText: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: spacing[1.5],
  },
  setsText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing[1.5],
  },
  dateText: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
    marginBottom: spacing[5],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[2.5],
  },
  button: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: spacing[3.5],
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: colors.primary,
  },
  startButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
    letterSpacing: typography.letterSpacing.wide,
  },
  skipButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  skipButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing[6],
    paddingBottom: spacing[10],
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing[4],
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing[3],
    fontSize: typography.sizes.base,
    color: colors.text,
    backgroundColor: colors.bgSurface,
    marginBottom: spacing[4],
    minHeight: 72,
  },
  modalButton: {
    borderRadius: radii.md,
    paddingVertical: spacing[3.5],
    alignItems: 'center',
    marginBottom: spacing[2.5],
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  skipConfirmButton: {
    backgroundColor: colors.danger,
  },
  skipConfirmButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  cancelButton: {
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
})

import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { FormFeedback } from '../../components/ui/FormFeedback'
import { getProfile, updateProfile } from '../../lib/profile'
import type { BiologicalSex } from '../../lib/profile'
import { colors, spacing, radii, typography } from '../../theme'
import { BackLink } from '../../components/navigation/BackLink'

const GENDER_OPTIONS: { value: BiologicalSex; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
]

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>
}

export default function ProfileScreen() {
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    staleTime: 5 * 60 * 1000,
  })

  const [displayName, setDisplayName] = useState('')
  const [gender, setGender] = useState<BiologicalSex | null>(null)
  const [birthYear, setBirthYear] = useState('')
  const [bodyweightKg, setBodyweightKg] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.display_name ?? '')
    setGender(profile.biological_sex ?? null)
    setBirthYear(profile.date_of_birth ? new Date(profile.date_of_birth).getFullYear().toString() : '')
    setBodyweightKg(profile.bodyweight_kg != null ? profile.bodyweight_kg.toString() : '')
  }, [profile])

  const birthYearIsValid = /^\d{4}$/.test(birthYear)

  const isDirty = useMemo(() => {
    const initialName = profile?.display_name ?? ''
    const initialGender = profile?.biological_sex ?? null
    const initialBirthYear = profile?.date_of_birth
      ? new Date(profile.date_of_birth).getFullYear().toString()
      : ''
    const initialBodyweight = profile?.bodyweight_kg != null ? profile.bodyweight_kg.toString() : ''

    return (
      displayName !== initialName ||
      gender !== initialGender ||
      birthYear !== initialBirthYear ||
      bodyweightKg !== initialBodyweight
    )
  }, [profile, displayName, gender, birthYear, bodyweightKg])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const yearNum = parseInt(birthYear, 10)
      const dobIso = `${yearNum}-01-01`

      const parsedBodyweight = bodyweightKg.trim() ? parseFloat(bodyweightKg) : null

      await updateProfile({
        display_name: displayName.trim() ? displayName.trim() : null,
        biological_sex: gender,
        date_of_birth: dobIso,
        bodyweight_kg: parsedBodyweight != null && !isNaN(parsedBodyweight) ? parsedBodyweight : null,
      })
    },
    onSuccess: async () => {
      setSaveSuccess(true)
      setSaveError(null)
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: () => {
      setSaveSuccess(false)
      setSaveError('Failed to save profile. Please try again.')
    },
  })

  function handleSave() {
    setSaveSuccess(false)
    setSaveError(null)
    if (!birthYearIsValid) {
      setSaveError('Birth year is required and must be 4 digits.')
      return
    }
    if (!gender) {
      setSaveError('Please select a gender.')
      return
    }
    saveMutation.mutate()
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing[10] }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackLink onPress={() => router.back()} />

        <Text style={styles.title}>Edit Profile</Text>

        <View style={styles.card}>
          <View style={styles.fieldBlock}>
            <FieldLabel label="Name" />
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Optional"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
              maxLength={40}
            />
          </View>

          <View style={styles.fieldBlock}>
            <FieldLabel label="Gender" />
            <View style={styles.sexRow}>
              {GENDER_OPTIONS.map((option) => {
                const selected = gender === option.value
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.sexOption, selected && styles.sexOptionSelected]}
                    onPress={() => setGender(option.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.sexOptionText, selected && styles.sexOptionTextSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <FieldLabel label="Birth Year" />
            <TextInput
              style={[styles.input, !birthYearIsValid && styles.inputError]}
              value={birthYear}
              onChangeText={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))}
              placeholder="e.g. 1990"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          <View style={styles.fieldBlockLast}>
            <FieldLabel label="Bodyweight (kg)" />
            <TextInput
              style={styles.input}
              value={bodyweightKg}
              onChangeText={setBodyweightKg}
              placeholder="e.g. 82.5"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <FormFeedback success={saveSuccess} error={saveError} />

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!isDirty || !birthYearIsValid || !gender || saveMutation.isPending) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!isDirty || !birthYearIsValid || !gender || saveMutation.isPending}
          activeOpacity={0.8}
        >
          {saveMutation.isPending
            ? <ActivityIndicator color={colors.textInverse} />
            : <Text style={styles.saveButtonText}>Save Changes</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[12],
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.black,
    color: colors.text,
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: spacing[6],
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
  },
  fieldBlock: {
    marginBottom: spacing[5],
  },
  fieldBlockLast: {
    marginBottom: 0,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[2],
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: typography.sizes.base,
  },
  inputError: {
    borderColor: colors.danger,
  },
  sexRow: {
    gap: spacing[2],
  },
  sexOption: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
  },
  sexOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  sexOptionText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  sexOptionTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  saveButton: {
    marginTop: spacing[5],
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing[3.5],
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.textInverse,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.wide,
  },
})

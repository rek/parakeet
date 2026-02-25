import { useState } from 'react'
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
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { Lift } from '@parakeet/shared-types'
import {
  getAuxiliaryPools,
  reorderAuxiliaryPool,
  getActiveAssignments,
  lockAssignment,
} from '../../lib/auxiliary-config'
import { getActiveProgram } from '../../lib/programs'
import { useAuth } from '../../hooks/useAuth'

// ── Constants ─────────────────────────────────────────────────────────────────

const LIFTS: Lift[] = ['squat', 'bench', 'deadlift']

const LIFT_LABELS: Record<Lift, string> = {
  squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentBlockNumber(startDateStr: string, totalWeeks: number): 1 | 2 | 3 {
  const start = new Date(startDateStr)
  const now = new Date()
  const weeksPassed = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
  const weeksPerBlock = Math.floor(totalWeeks / 3)
  const block = Math.min(3, Math.floor(weeksPassed / weeksPerBlock) + 1)
  return block as 1 | 2 | 3
}

// ── Pool list ─────────────────────────────────────────────────────────────────

interface PoolListProps {
  pool: string[]
  onReorder: (pool: string[]) => void
  onRemove: (i: number) => void
}

function PoolList({ pool, onReorder, onRemove }: PoolListProps) {
  function moveUp(i: number) {
    if (i === 0) return
    const next = [...pool]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    onReorder(next)
  }

  function moveDown(i: number) {
    if (i === pool.length - 1) return
    const next = [...pool]
    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
    onReorder(next)
  }

  return (
    <View style={styles.poolList}>
      {pool.map((ex, i) => (
        <View key={`${ex}-${i}`} style={styles.poolItem}>
          <Text style={styles.poolPosition}>{i + 1}.</Text>
          <Text style={styles.poolExercise} numberOfLines={1}>{ex}</Text>
          <View style={styles.poolActions}>
            <TouchableOpacity
              style={[styles.reorderBtn, i === 0 && styles.reorderBtnDisabled]}
              onPress={() => moveUp(i)}
              disabled={i === 0}
              activeOpacity={0.7}
            >
              <Text style={styles.reorderBtnText}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reorderBtn, i === pool.length - 1 && styles.reorderBtnDisabled]}
              onPress={() => moveDown(i)}
              disabled={i === pool.length - 1}
              activeOpacity={0.7}
            >
              <Text style={styles.reorderBtnText}>↓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => onRemove(i)}
              activeOpacity={0.7}
            >
              <Text style={styles.removeBtnText}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  )
}

// ── Assignment picker ─────────────────────────────────────────────────────────

interface SlotPickerProps {
  label: string
  value: string
  pool: string[]
  onChange: (v: string) => void
}

function SlotPicker({ label, value, pool, onChange }: SlotPickerProps) {
  const idx = pool.indexOf(value)

  function prev() {
    const next = (idx - 1 + pool.length) % pool.length
    onChange(pool[next])
  }

  function next() {
    const next = (idx + 1) % pool.length
    onChange(pool[next])
  }

  return (
    <View style={styles.slotPicker}>
      <Text style={styles.slotLabel}>{label}</Text>
      <View style={styles.slotControls}>
        <TouchableOpacity style={styles.slotArrow} onPress={prev} activeOpacity={0.7}>
          <Text style={styles.slotArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.slotValue} numberOfLines={1}>{value}</Text>
        <TouchableOpacity style={styles.slotArrow} onPress={next} activeOpacity={0.7}>
          <Text style={styles.slotArrowText}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Lift section ──────────────────────────────────────────────────────────────

interface LiftSectionProps {
  lift: Lift
  pool: string[]
  assignment: [string, string] | null
  blockNumber: 1 | 2 | 3 | null
  isSavingPool: boolean
  isSavingAssignment: boolean
  onPoolChange: (pool: string[]) => void
  onSavePool: () => void
  onAssignmentChange: (pair: [string, string]) => void
  onSaveAssignment: () => void
}

function LiftSection({
  lift, pool, assignment, blockNumber,
  isSavingPool, isSavingAssignment,
  onPoolChange, onSavePool,
  onAssignmentChange, onSaveAssignment,
}: LiftSectionProps) {
  const [newExercise, setNewExercise] = useState('')

  function addExercise() {
    const trimmed = newExercise.trim()
    if (!trimmed || pool.includes(trimmed)) return
    onPoolChange([...pool, trimmed])
    setNewExercise('')
  }

  function removeExercise(i: number) {
    onPoolChange(pool.filter((_, idx) => idx !== i))
  }

  return (
    <View style={styles.liftSection}>
      <View style={styles.liftHeader}>
        <Text style={styles.liftTitle}>{LIFT_LABELS[lift]}</Text>
        <TouchableOpacity
          style={[styles.saveBtn, isSavingPool && styles.saveBtnDisabled]}
          onPress={onSavePool}
          disabled={isSavingPool}
          activeOpacity={0.8}
        >
          {isSavingPool
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>Save Pool</Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Pool Order</Text>
      <PoolList pool={pool} onReorder={onPoolChange} onRemove={removeExercise} />

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="Add exercise…"
          placeholderTextColor="#9CA3AF"
          value={newExercise}
          onChangeText={setNewExercise}
          onSubmitEditing={addExercise}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addBtn, !newExercise.trim() && styles.addBtnDisabled]}
          onPress={addExercise}
          disabled={!newExercise.trim()}
          activeOpacity={0.7}
        >
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {assignment && blockNumber && pool.length >= 2 && (
        <View style={styles.assignmentCard}>
          <View style={styles.assignmentHeader}>
            <Text style={styles.assignmentTitle}>Block {blockNumber} Assignment</Text>
            <TouchableOpacity
              style={[styles.saveAssignmentBtn, isSavingAssignment && styles.saveBtnDisabled]}
              onPress={onSaveAssignment}
              disabled={isSavingAssignment}
              activeOpacity={0.8}
            >
              {isSavingAssignment
                ? <ActivityIndicator color="#4F46E5" size="small" />
                : <Text style={styles.saveAssignmentBtnText}>Lock</Text>
              }
            </TouchableOpacity>
          </View>
          <SlotPicker
            label="Slot 1"
            value={assignment[0]}
            pool={pool}
            onChange={(v) => onAssignmentChange([v, assignment[1]])}
          />
          <SlotPicker
            label="Slot 2"
            value={assignment[1]}
            pool={pool}
            onChange={(v) => onAssignmentChange([assignment[0], v])}
          />
        </View>
      )}
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

type Pools = Record<Lift, string[]>
type Assignments = Record<Lift, [string, string]>

export default function AuxiliaryExercisesScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [pools, setPools] = useState<Pools | null>(null)
  const [assignments, setAssignments] = useState<Partial<Assignments>>({})
  const [blockNumber, setBlockNumber] = useState<1 | 2 | 3 | null>(null)
  const [programId, setProgramId] = useState<string | null>(null)
  const [savingPool, setSavingPool] = useState<Partial<Record<Lift, boolean>>>({})
  const [savingAssignment, setSavingAssignment] = useState<Partial<Record<Lift, boolean>>>({})

  const { isLoading } = useQuery({
    queryKey: ['auxiliary', 'pools', user?.id],
    queryFn: () => getAuxiliaryPools(user!.id),
    enabled: !!user?.id,
    onSuccess: (data) => {
      if (!pools) setPools(data)
    },
  })

  useQuery({
    queryKey: ['programs', 'active', user?.id],
    queryFn: () => getActiveProgram(user!.id),
    enabled: !!user?.id,
    onSuccess: async (program) => {
      if (!program) return
      const bn = currentBlockNumber(program.start_date, program.total_weeks)
      setBlockNumber(bn)
      setProgramId(program.id)
      const loaded = await getActiveAssignments(user!.id, program.id, bn)
      setAssignments(
        Object.fromEntries(
          LIFTS.map((l) => [l, loaded[l] ?? (pools ? [pools[l][0], pools[l][1]] : ['', ''])]),
        ) as Partial<Assignments>,
      )
    },
  })

  async function handleSavePool(lift: Lift) {
    if (!pools || !user) return
    setSavingPool((prev) => ({ ...prev, [lift]: true }))
    try {
      await reorderAuxiliaryPool(user.id, lift, pools[lift])
      queryClient.invalidateQueries({ queryKey: ['auxiliary'] })
    } finally {
      setSavingPool((prev) => ({ ...prev, [lift]: false }))
    }
  }

  async function handleSaveAssignment(lift: Lift) {
    if (!user || !programId || !blockNumber || !assignments[lift]) return
    const [ex1, ex2] = assignments[lift]!
    setSavingAssignment((prev) => ({ ...prev, [lift]: true }))
    try {
      await lockAssignment(user.id, programId, lift, blockNumber, ex1, ex2)
      queryClient.invalidateQueries({ queryKey: ['auxiliary'] })
    } finally {
      setSavingAssignment((prev) => ({ ...prev, [lift]: false }))
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Auxiliary Exercises</Text>
        <Text style={styles.subtitle}>Reorder to influence future rotation · add custom exercises</Text>
      </View>

      {isLoading || !pools ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#4F46E5" size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {LIFTS.map((lift) => (
            <LiftSection
              key={lift}
              lift={lift}
              pool={pools[lift]}
              assignment={(assignments[lift] ?? null) as [string, string] | null}
              blockNumber={blockNumber}
              isSavingPool={!!savingPool[lift]}
              isSavingAssignment={!!savingAssignment[lift]}
              onPoolChange={(p) => setPools((prev) => prev ? { ...prev, [lift]: p } : prev)}
              onSavePool={() => handleSavePool(lift)}
              onAssignmentChange={(pair) => setAssignments((prev) => ({ ...prev, [lift]: pair }))}
              onSaveAssignment={() => handleSaveAssignment(lift)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 2,
  },
  backButton: { marginBottom: 6 },
  backText: { fontSize: 15, color: '#4F46E5', fontWeight: '500' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#9CA3AF', lineHeight: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { paddingBottom: 48 },

  liftSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  liftHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liftTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  saveBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  poolList: { gap: 4 },
  poolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    gap: 8,
  },
  poolPosition: { fontSize: 12, color: '#9CA3AF', width: 20, textAlign: 'right' },
  poolExercise: { flex: 1, fontSize: 14, color: '#111827' },
  poolActions: { flexDirection: 'row', gap: 4 },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: { opacity: 0.25 },
  reorderBtnText: { fontSize: 14, color: '#374151' },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { fontSize: 16, color: '#EF4444', lineHeight: 20 },

  addRow: { flexDirection: 'row', gap: 8 },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111827',
  },
  addBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.35 },
  addBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  assignmentCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  assignmentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  assignmentTitle: { fontSize: 13, fontWeight: '600', color: '#4F46E5' },
  saveAssignmentBtn: {
    borderWidth: 1,
    borderColor: '#4F46E5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  saveAssignmentBtnText: { fontSize: 12, fontWeight: '600', color: '#4F46E5' },

  slotPicker: { gap: 4 },
  slotLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  slotControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotArrow: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  slotArrowText: { fontSize: 18, color: '#4F46E5', lineHeight: 22 },
  slotValue: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
})

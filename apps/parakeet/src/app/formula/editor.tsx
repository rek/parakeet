import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { FormulaConfig, BlockIntensityConfig, RepIntensityConfig } from '@parakeet/training-engine'
import {
  getFormulaConfig,
  getFormulaHistory,
  getPendingAiFormulaSuggestions,
  createFormulaOverride,
  deactivateFormulaConfig,
} from '../../lib/formulas'
import { getActiveProgram } from '../../lib/programs'
import { getCurrentOneRmKg } from '../../lib/lifter-maxes'
import { useAuth } from '../../hooks/useAuth'
import { colors } from '../../theme'
import { BackLink } from '../../components/navigation/BackLink'

// ── Types ─────────────────────────────────────────────────────────────────────

type TopTab = 'editor' | 'history' | 'suggestions'
type BlockKey = 'block1' | 'block2' | 'block3' | 'deload'
type IntensityKey = 'heavy' | 'explosive' | 'rep'

interface RowDraft {
  pct: string
  sets: string
  reps: string
  repsMax?: string
  rpeTarget: string
  setsMin?: string
  setsMax?: string
  repsMin?: string
}

type DraftConfig = {
  [B in BlockKey]: {
    heavy?:     RowDraft
    explosive?: RowDraft
    rep?:       RowDraft
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRowDraft(config: BlockIntensityConfig | RepIntensityConfig): RowDraft {
  if ('sets_min' in config) {
    return {
      pct:      String(Math.round(config.pct * 100)),
      sets:     String(config.sets_min),
      reps:     String(config.reps_min),
      rpeTarget: String(config.rpe_target),
      setsMin:  String(config.sets_min),
      setsMax:  String(config.sets_max),
      repsMin:  String(config.reps_min),
      repsMax:  String(config.reps_max),
    }
  }
  return {
    pct:      String(Math.round(config.pct * 100)),
    sets:     String(config.sets),
    reps:     String(config.reps),
    repsMax:  config.reps_max != null ? String(config.reps_max) : undefined,
    rpeTarget: String(config.rpe_target),
  }
}

function initDraft(config: FormulaConfig): DraftConfig {
  return {
    block1: {
      heavy:     toRowDraft(config.block1.heavy),
      explosive: toRowDraft(config.block1.explosive),
      rep:       toRowDraft(config.block1.rep),
    },
    block2: {
      heavy:     toRowDraft(config.block2.heavy),
      explosive: toRowDraft(config.block2.explosive),
      rep:       toRowDraft(config.block2.rep),
    },
    block3: {
      heavy:     toRowDraft(config.block3.heavy),
      explosive: toRowDraft(config.block3.explosive),
      rep:       toRowDraft(config.block3.rep),
    },
    deload: {
      heavy: toRowDraft(config.deload),
    },
  }
}

function draftToOverrides(draft: DraftConfig): Partial<FormulaConfig> {
  const p = (s: string) => parseFloat(s) || 0
  const i = (s: string) => parseInt(s, 10) || 0

  function blockRow(row: RowDraft): BlockIntensityConfig {
    return {
      pct:       p(row.pct) / 100,
      sets:      i(row.sets),
      reps:      i(row.reps),
      rpe_target: p(row.rpeTarget),
      ...(row.repsMax ? { reps_max: i(row.repsMax) } : {}),
    }
  }

  function repRow(row: RowDraft): RepIntensityConfig {
    return {
      pct:       p(row.pct) / 100,
      sets_min:  i(row.setsMin ?? row.sets),
      sets_max:  i(row.setsMax ?? row.sets),
      reps_min:  i(row.repsMin ?? row.reps),
      reps_max:  i(row.repsMax ?? row.reps),
      rpe_target: p(row.rpeTarget),
    }
  }

  return {
    block1: {
      heavy:     blockRow(draft.block1.heavy!),
      explosive: blockRow(draft.block1.explosive!),
      rep:       repRow(draft.block1.rep!),
    },
    block2: {
      heavy:     blockRow(draft.block2.heavy!),
      explosive: blockRow(draft.block2.explosive!),
      rep:       repRow(draft.block2.rep!),
    },
    block3: {
      heavy:     blockRow(draft.block3.heavy!),
      explosive: blockRow(draft.block3.explosive!),
      rep:       repRow(draft.block3.rep!),
    },
    deload: {
      pct:       p(draft.deload.heavy!.pct) / 100,
      sets:      i(draft.deload.heavy!.sets),
      reps:      i(draft.deload.heavy!.reps),
      rpe_target: p(draft.deload.heavy!.rpeTarget),
    },
  }
}

function exampleWeight(pct: string, oneRmKg: number): string {
  const p = parseFloat(pct)
  if (!p || !oneRmKg) return '—'
  return `${Math.round((p / 100) * oneRmKg * 2) / 2} kg`
}

// ── Editable row ──────────────────────────────────────────────────────────────

interface RowProps {
  label: string
  draft: RowDraft
  oneRmKg: number
  isEditing: boolean
  onToggleEdit: () => void
  onUpdate: (next: RowDraft) => void
  isRep?: boolean
}

function IntensityRow({ label, draft, oneRmKg, isEditing, onToggleEdit, onUpdate, isRep }: RowProps) {
  const summary = isRep
    ? `${draft.pct}% — ${draft.setsMin ?? draft.sets}–${draft.setsMax ?? draft.sets} sets × ${draft.repsMin ?? draft.reps}–${draft.repsMax ?? draft.reps} reps — RPE ${draft.rpeTarget}`
    : `${draft.pct}% — ${draft.sets} sets × ${draft.reps}${draft.repsMax ? `–${draft.repsMax}` : ''} reps — RPE ${draft.rpeTarget}`

  const sampleKg = exampleWeight(draft.pct, oneRmKg)

  return (
    <TouchableOpacity
      style={[styles.intensityRow, isEditing && styles.intensityRowActive]}
      onPress={onToggleEdit}
      activeOpacity={0.7}
    >
      <View style={styles.intensityRowHeader}>
        <Text style={styles.intensityLabel}>{label}</Text>
        <Text style={styles.sampleWeight}>{sampleKg}</Text>
      </View>
      <Text style={styles.intensitySummary}>{summary}</Text>

      {isEditing && (
        <View style={styles.editFields}>
          <View style={styles.editRow}>
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>%</Text>
              <TextInput
                style={styles.editInput}
                value={draft.pct}
                onChangeText={(v) => onUpdate({ ...draft, pct: v })}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>{isRep ? 'Sets min' : 'Sets'}</Text>
              <TextInput
                style={styles.editInput}
                value={isRep ? (draft.setsMin ?? draft.sets) : draft.sets}
                onChangeText={(v) => onUpdate(isRep ? { ...draft, setsMin: v } : { ...draft, sets: v })}
                keyboardType="number-pad"
              />
            </View>
            {isRep && (
              <View style={styles.editField}>
                <Text style={styles.editFieldLabel}>Sets max</Text>
                <TextInput
                  style={styles.editInput}
                  value={draft.setsMax ?? draft.sets}
                  onChangeText={(v) => onUpdate({ ...draft, setsMax: v })}
                  keyboardType="number-pad"
                />
              </View>
            )}
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>{isRep ? 'Reps min' : 'Reps'}</Text>
              <TextInput
                style={styles.editInput}
                value={isRep ? (draft.repsMin ?? draft.reps) : draft.reps}
                onChangeText={(v) => onUpdate(isRep ? { ...draft, repsMin: v } : { ...draft, reps: v })}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>{isRep ? 'Reps max' : 'Reps max'}</Text>
              <TextInput
                style={styles.editInput}
                value={draft.repsMax ?? ''}
                onChangeText={(v) => onUpdate({ ...draft, repsMax: v || undefined })}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editFieldLabel}>RPE</Text>
              <TextInput
                style={styles.editInput}
                value={draft.rpeTarget}
                onChangeText={(v) => onUpdate({ ...draft, rpeTarget: v })}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FormulaEditorScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [topTab, setTopTab]           = useState<TopTab>('editor')
  const [activeBlock, setActiveBlock] = useState<BlockKey>('block1')
  const [editingRow, setEditingRow]   = useState<string | null>(null)
  const [draft, setDraft]             = useState<DraftConfig | null>(null)
  const [showSaveSheet, setShowSaveSheet] = useState(false)
  const [regenerate, setRegenerate]   = useState(false)
  const [isSaving, setIsSaving]       = useState(false)

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['formula', 'config', user?.id],
    queryFn: () => getFormulaConfig(user!.id),
    enabled: !!user?.id,
  })

  const { data: history } = useQuery({
    queryKey: ['formula', 'history', user?.id],
    queryFn: () => getFormulaHistory(user!.id),
    enabled: !!user?.id && topTab === 'history',
  })

  const { data: aiSuggestions } = useQuery({
    queryKey: ['formula', 'suggestions', user?.id],
    queryFn: () => getPendingAiFormulaSuggestions(user!.id),
    enabled: !!user?.id && topTab === 'suggestions',
  })

  const { data: oneRmKg = 0 } = useQuery({
    queryKey: ['maxes', 'squat-1rm', user?.id],
    queryFn: () => getCurrentOneRmKg(user!.id, 'squat'),
    enabled: !!user?.id,
    select: (v) => v ?? 0,
  })

  const { data: activeProgram } = useQuery({
    queryKey: ['program', 'active', user?.id],
    queryFn: () => getActiveProgram(user!.id),
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (config && !draft) {
      setDraft(initDraft(config))
    }
  }, [config, draft])

  const updateRow = useCallback((block: BlockKey, row: IntensityKey, next: RowDraft) => {
    setDraft((prev) => prev ? { ...prev, [block]: { ...prev[block], [row]: next } } : prev)
  }, [])

  async function handleSave() {
    if (!draft || !user) return
    setIsSaving(true)
    try {
      const overrides = draftToOverrides(draft)
      await createFormulaOverride(user.id, { overrides, source: 'user' })
      if (regenerate && activeProgram) {
        const { regenerateProgram } = await import('../../lib/programs')
        await regenerateProgram({
          totalWeeks: activeProgram.total_weeks as 10 | 12 | 14,
          trainingDaysPerWeek: activeProgram.training_days_per_week as 3 | 4,
          startDate: new Date(),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['formula'] })
      setShowSaveSheet(false)
      router.back()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAcceptSuggestion(suggestionId: string, overrides: unknown) {
    if (!user) return
    await createFormulaOverride(user.id, {
      overrides: overrides as Partial<FormulaConfig>,
      source: 'ai_suggestion',
    })
    queryClient.invalidateQueries({ queryKey: ['formula'] })
  }

  async function handleDismissSuggestion(suggestionId: string) {
    if (!user) return
    await deactivateFormulaConfig(suggestionId, user.id)
    queryClient.invalidateQueries({ queryKey: ['formula', 'suggestions'] })
  }

  async function handleReactivate(configId: string, overrides: unknown) {
    if (!user) return
    await createFormulaOverride(user.id, {
      overrides: overrides as Partial<FormulaConfig>,
      source: 'user',
    })
    queryClient.invalidateQueries({ queryKey: ['formula'] })
  }

  // ── Block tab content ──────────────────────────────────────────────────────

  function renderBlockContent(block: BlockKey) {
    if (!draft) return null
    const blockDraft = draft[block]

    if (block === 'deload') {
      const d = blockDraft.heavy!
      return (
        <IntensityRow
          label="Deload"
          draft={d}
          oneRmKg={oneRmKg}
          isEditing={editingRow === 'deload-heavy'}
          onToggleEdit={() => setEditingRow(editingRow === 'deload-heavy' ? null : 'deload-heavy')}
          onUpdate={(next) => updateRow(block, 'heavy', next)}
        />
      )
    }

    return (
      <>
        <IntensityRow
          label="Heavy"
          draft={blockDraft.heavy!}
          oneRmKg={oneRmKg}
          isEditing={editingRow === `${block}-heavy`}
          onToggleEdit={() => setEditingRow(editingRow === `${block}-heavy` ? null : `${block}-heavy`)}
          onUpdate={(next) => updateRow(block, 'heavy', next)}
        />
        <IntensityRow
          label="Explosive"
          draft={blockDraft.explosive!}
          oneRmKg={oneRmKg}
          isEditing={editingRow === `${block}-explosive`}
          onToggleEdit={() => setEditingRow(editingRow === `${block}-explosive` ? null : `${block}-explosive`)}
          onUpdate={(next) => updateRow(block, 'explosive', next)}
        />
        <IntensityRow
          label="Rep"
          draft={blockDraft.rep!}
          oneRmKg={oneRmKg}
          isEditing={editingRow === `${block}-rep`}
          onToggleEdit={() => setEditingRow(editingRow === `${block}-rep` ? null : `${block}-rep`)}
          onUpdate={(next) => updateRow(block, 'rep', next)}
          isRep
        />
      </>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <BackLink onPress={() => router.back()} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Formulas</Text>
          {topTab === 'editor' && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => setShowSaveSheet(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Top tabs */}
      <View style={styles.topTabs}>
        {(['editor', 'history', 'suggestions'] as TopTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.topTab, topTab === t && styles.topTabActive]}
            onPress={() => setTopTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[styles.topTabText, topTab === t && styles.topTabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'suggestions' && (aiSuggestions?.length ?? 0) > 0 && (
                <Text style={styles.badge}> ●</Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Editor tab */}
      {topTab === 'editor' && (
        <>
          {/* Block sub-tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.blockTabsScroll}>
            <View style={styles.blockTabs}>
              {(['block1', 'block2', 'block3', 'deload'] as BlockKey[]).map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[styles.blockTab, activeBlock === b && styles.blockTabActive]}
                  onPress={() => setActiveBlock(b)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.blockTabText, activeBlock === b && styles.blockTabTextActive]}>
                    {b === 'deload' ? 'Deload' : `Block ${b.slice(-1)}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {configLoading || !draft ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <>
                {oneRmKg > 0 && (
                  <Text style={styles.exampleNote}>
                    Example weights based on your squat 1RM ({oneRmKg} kg)
                  </Text>
                )}
                {renderBlockContent(activeBlock)}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* History tab */}
      {topTab === 'history' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {(history ?? []).map((item) => (
            <View key={item.id} style={styles.historyItem}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyDate}>
                  {new Date(item.created_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
                </Text>
                <View style={[
                  styles.sourceBadge,
                  item.source === 'ai_suggestion' && styles.sourceBadgeAi,
                ]}>
                  <Text style={styles.sourceBadgeText}>
                    {item.source === 'user' ? 'User' : item.source === 'ai_suggestion' ? 'AI' : 'System'}
                  </Text>
                </View>
                {item.is_active && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                )}
              </View>
              {item.ai_rationale && (
                <Text style={styles.historyRationale}>{item.ai_rationale}</Text>
              )}
              {!item.is_active && (
                <TouchableOpacity
                  style={styles.reactivateButton}
                  onPress={() => handleReactivate(item.id, item.overrides)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reactivateButtonText}>Reactivate</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {(history ?? []).length === 0 && (
            <Text style={styles.emptyText}>No formula history yet.</Text>
          )}
        </ScrollView>
      )}

      {/* AI Suggestions tab */}
      {topTab === 'suggestions' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {(aiSuggestions ?? []).map((item) => (
            <View key={item.id} style={styles.suggestionCard}>
              {item.ai_rationale && (
                <Text style={styles.suggestionRationale}>{item.ai_rationale}</Text>
              )}
              <View style={styles.suggestionActions}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAcceptSuggestion(item.id, item.overrides)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => handleDismissSuggestion(item.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {(aiSuggestions ?? []).length === 0 && (
            <Text style={styles.emptyText}>No AI suggestions pending.</Text>
          )}
        </ScrollView>
      )}

      {/* Save bottom sheet */}
      <Modal
        visible={showSaveSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSaveSheet(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Save Formula</Text>
            <Text style={styles.sheetSubtitle}>
              This will create a new formula version. Your current version is saved in history.
            </Text>

            <View style={styles.sheetToggleRow}>
              <Text style={styles.sheetToggleLabel}>Regenerate program with new formula</Text>
              <Switch
                value={regenerate}
                onValueChange={setRegenerate}
                trackColor={{ true: colors.primary }}
              />
            </View>
            {regenerate && (
              <Text style={styles.sheetToggleNote}>
                All planned sessions will be regenerated. Completed sessions are preserved.
              </Text>
            )}

            <TouchableOpacity
              style={[styles.sheetConfirmButton, isSaving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <Text style={styles.sheetConfirmText}>
                  {regenerate ? 'Save & Regenerate Program' : 'Save Formula'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancelButton}
              onPress={() => setShowSaveSheet(false)}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bgSurface },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgMuted,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: { fontSize: 14, fontWeight: '600', color: colors.textInverse },

  // Top tabs
  topTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  topTabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  topTabText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  topTabTextActive: { color: colors.primary, fontWeight: '600' },
  badge: { color: colors.danger },

  // Block sub-tabs
  blockTabsScroll: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.bgMuted },
  blockTabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 4, alignItems: 'center' },
  blockTab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  blockTabActive: { backgroundColor: colors.primaryMuted },
  blockTabText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  blockTabTextActive: { color: colors.primary, fontWeight: '600' },

  scroll: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },

  exampleNote: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 4,
  },

  // Intensity row
  intensityRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  intensityRowActive: { borderColor: colors.primary, backgroundColor: colors.bgSurface },
  intensityRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  intensityLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  sampleWeight: { fontSize: 13, color: colors.textSecondary },
  intensitySummary: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

  // Edit fields
  editFields: { marginTop: 12 },
  editRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  editField: { minWidth: 60, flex: 1 },
  editFieldLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  editInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
  },

  // History
  historyItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyDate: { fontSize: 14, color: colors.textSecondary, flex: 1 },
  sourceBadge: {
    backgroundColor: colors.bgMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sourceBadgeAi: { backgroundColor: colors.primaryMuted },
  sourceBadgeText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  activeBadge: {
    backgroundColor: colors.successMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeBadgeText: { fontSize: 11, fontWeight: '600', color: colors.success },
  historyRationale: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  reactivateButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: 4,
  },
  reactivateButtonText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  // AI suggestions
  suggestionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  suggestionRationale: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  suggestionActions: { flexDirection: 'row', gap: 10 },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptButtonText: { fontSize: 14, fontWeight: '600', color: colors.textInverse },
  dismissButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissButtonText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },

  emptyText: { fontSize: 14, color: colors.textTertiary, textAlign: 'center', marginTop: 32 },

  // Save sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: colors.overlayLight,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sheetSubtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  sheetToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetToggleLabel: { fontSize: 15, color: colors.text, flex: 1, marginRight: 12 },
  sheetToggleNote: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  sheetConfirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sheetConfirmText: { fontSize: 16, fontWeight: '600', color: colors.textInverse },
  sheetCancelButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sheetCancelText: { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
  buttonDisabled: { opacity: 0.4 },
})

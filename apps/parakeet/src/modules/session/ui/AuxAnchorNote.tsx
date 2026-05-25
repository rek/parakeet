// @spec docs/features/auxiliary-exercises/spec-history-anchored-weight.md
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { roundToNearest } from '@shared/utils/weight';

import type { ColorScheme } from '../../../theme';
import type { AuxiliaryWork } from '../model/types';
import { shouldShowAnchorNote } from './aux-anchor-note.helpers';

interface AuxAnchorNoteProps {
  anchor: NonNullable<AuxiliaryWork['anchor']>;
  /** Engine's final prescribed weight after modifiers + plate rounding.
   *  Shown to the lifter as today's prescription; only used as a row in
   *  the explainer sheet — the note copy compares anchor base to formula. */
  prescribedWeightKg: number;
  /** Plate increment the lifter can actually load. Drives display rounding
   *  AND the hysteresis check on the divergence decision. */
  weightIncrementKg: number;
  colors: ColorScheme;
}

/**
 * Inline one-line note shown under an aux exercise name when the
 * history-anchored weight diverges meaningfully from the catalog formula.
 * Tapping opens an explainer sheet with the contributing sessions.
 *
 * Hidden when:
 *   - source is 'formula' (no anchor was used)
 *   - divergence is within the threshold (≤ 20%)
 *   - plate-rounding hysteresis: rounded(anchorBase) == rounded(formula)
 *
 * Note copy compares ANCHOR BASE (pre-modifier) to FORMULA, so the lifter
 * doesn't see "Using your recent 70kg rather than 100kg" on a heavy day
 * when their recent lifts were actually 100kg.
 */
export function AuxAnchorNote({
  anchor,
  prescribedWeightKg,
  weightIncrementKg,
  colors,
}: AuxAnchorNoteProps) {
  const [expanded, setExpanded] = useState(false);

  if (!shouldShowAnchorNote({ anchor, weightIncrementKg })) {
    return null;
  }
  const incr = weightIncrementKg > 0 ? weightIncrementKg : 2.5;

  const styles = buildStyles(colors);
  const note = `Using your recent ${roundToNearest(anchor.anchorBaseKg, incr)}kg rather than the formula's ${roundToNearest(anchor.formulaWeightKg, incr)}kg`;

  return (
    <>
      <TouchableOpacity
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        accessibilityLabel="View anchor details"
      >
        <Text style={styles.note}>{note}</Text>
      </TouchableOpacity>
      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setExpanded(false)}
        />
        <View style={styles.sheet}>
          <ScrollView style={styles.sheetScroll}>
            <Text style={styles.sheetHeader}>How this weight was chosen</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Source</Text>
              <Text style={styles.value}>{labelForSource(anchor.source)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Confidence</Text>
              <Text style={styles.value}>
                {labelForConfidence(anchor.confidence)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Sessions used</Text>
              <Text style={styles.value}>{anchor.sessionsUsed}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Formula would suggest</Text>
              <Text style={styles.value}>
                {roundToNearest(anchor.formulaWeightKg, incr)}kg
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Anchor base</Text>
              <Text style={styles.value}>
                {roundToNearest(anchor.anchorBaseKg, incr)}kg
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Prescribed today</Text>
              <Text style={styles.value}>{prescribedWeightKg}kg</Text>
            </View>
            <Text style={styles.rationale}>
              {anchor.fromLLMOverride
                ? `AI suggested: ${anchor.rationale}`
                : anchor.rationale}
            </Text>
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function labelForSource(source: AuxAnchorNoteProps['anchor']['source']): string {
  switch (source) {
    case 'history':
      return 'Your recent sessions';
    case 'snap':
      return 'Your override (adopted)';
    case 'blend':
      return 'Blending formula + your history';
    case 'formula':
      return 'Catalog formula';
  }
}

function labelForConfidence(
  c: AuxAnchorNoteProps['anchor']['confidence']
): string {
  switch (c) {
    case 'exploring':
      return 'Exploring';
    case 'low':
      return 'Low';
    case 'medium':
      return 'Medium';
    case 'high':
      return 'High';
  }
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    note: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 2,
      marginBottom: 4,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '70%',
      backgroundColor: colors.bgSurface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 32,
    },
    sheetScroll: {
      maxHeight: 480,
    },
    sheetHeader: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    label: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    value: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    rationale: {
      marginTop: 16,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    closeButton: {
      marginTop: 20,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: colors.bgMuted ?? colors.border,
      borderRadius: 8,
    },
    closeButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
  });
}

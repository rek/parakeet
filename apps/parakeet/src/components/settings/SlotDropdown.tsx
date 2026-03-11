import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { getPrimaryMuscles } from '@modules/program';

import { useTheme } from '../../theme/ThemeContext';
import { MuscleChips } from './MuscleChips';

interface SlotDropdownProps {
  label: string;
  value: string;
  pool: string[];
  onChange: (v: string) => void;
}

export function SlotDropdown({
  label,
  value,
  pool,
  onChange,
}: SlotDropdownProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { gap: 4 },
        label: {
          fontSize: 11,
          color: colors.textSecondary,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        },
        trigger: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.bgSurface,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
        triggerText: {
          flex: 1,
          fontSize: 14,
          color: colors.text,
          fontWeight: '500',
        },
        chevron: { fontSize: 18, color: colors.textSecondary },
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-start',
        },
        sheet: {
          backgroundColor: colors.bgSurface,
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          maxHeight: '70%',
          paddingBottom: 16,
          paddingTop: 48,
        },
        search: {
          margin: 12,
          backgroundColor: colors.bgMuted,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 14,
          color: colors.text,
        },
        option: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 4,
          borderBottomWidth: 1,
          borderBottomColor: colors.bgMuted,
        },
        optionText: { fontSize: 15, color: colors.text },
        optionSelected: { color: colors.primary, fontWeight: '600' },
        cancel: { alignItems: 'center', paddingVertical: 14 },
        cancelText: { fontSize: 15, color: colors.danger, fontWeight: '600' },
      }),
    [colors]
  );

  const filtered = query.trim()
    ? pool.filter((ex) => ex.toLowerCase().includes(query.trim().toLowerCase()))
    : pool;

  function select(ex: string) {
    onChange(ex);
    setOpen(false);
    setQuery('');
  }

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.triggerText} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <TextInput
              style={styles.search}
              placeholder="Search exercises…"
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            <FlatList
              data={filtered}
              keyExtractor={(ex, i) => `${ex}-${i}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: ex }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => select(ex)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionText,
                      ex === value && styles.optionSelected,
                    ]}
                  >
                    {ex}
                  </Text>
                  <MuscleChips muscles={getPrimaryMuscles(ex)} />
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.cancel} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

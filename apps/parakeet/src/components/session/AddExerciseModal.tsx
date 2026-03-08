import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../theme';

interface Props {
  visible: boolean;
  onConfirm: (exercise: string) => void;
  onClose: () => void;
}

export function AddExerciseModal({ visible, onConfirm, onClose }: Props) {
  const [input, setInput] = useState('');

  function handleConfirm() {
    const name = input.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name) return;
    onConfirm(name);
    setInput('');
  }

  function handleClose() {
    setInput('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      >
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Add Exercise</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. face pulls, lat pulldown"
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional for modal UX
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
            autoCapitalize="none"
          />
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, !input.trim() && styles.addButtonDisabled]}
              onPress={handleConfirm}
              disabled={!input.trim()}
            >
              <Text style={styles.addText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: colors.bgSurface,
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 20,
    backgroundColor: colors.bgSurface,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  addButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textInverse,
  },
});

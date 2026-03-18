import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, typography } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  position?: 'top' | 'bottom';
  /** Fraction of available screen height (0–1). Default 0.65. */
  maxHeightFraction?: number;
  children: ReactNode;
}

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  position = 'bottom',
  maxHeightFraction = 0.65,
  children,
}: SheetProps) {
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const sheetMaxHeight = useMemo(() => {
    const safeHeight = windowHeight - insets.top - insets.bottom;
    return safeHeight * maxHeightFraction;
  }, [windowHeight, insets.top, insets.bottom, maxHeightFraction]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          justifyContent: position === 'top' ? 'flex-start' : 'flex-end',
          backgroundColor: colors.overlayLight,
        },
        sheet: {
          backgroundColor: colors.bgSurface,
          maxHeight: sheetMaxHeight,
          ...(position === 'top'
            ? {
                borderBottomLeftRadius: 20,
                borderBottomRightRadius: 20,
                paddingTop: insets.top + 12,
                paddingBottom: 20,
              }
            : {
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: insets.bottom + 20,
              }),
        },
        handle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: 'center',
          marginTop: spacing[2],
          marginBottom: spacing[1],
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerLeft: {
          flex: 1,
          gap: spacing[1],
        },
        title: {
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.bold,
          color: colors.text,
        },
        subtitle: {
          fontSize: typography.sizes.xs,
          color: colors.textTertiary,
        },
        closeBtn: {
          fontSize: 16,
          color: colors.textSecondary,
          fontWeight: typography.weights.bold,
        },
      }),
    [colors, position, sheetMaxHeight, insets.top, insets.bottom]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>{title}</Text>
              {subtitle != null && (
                <Text style={styles.subtitle}>{subtitle}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7}>
              <Text style={styles.closeBtn}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>

          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

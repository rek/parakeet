import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { radii, spacing, typography } from '../../theme';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

const DRAWER_WIDTH = Math.min(300, Dimensions.get('window').width * 0.8);

export function LeftDrawer({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : -DRAWER_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateX, overlayOpacity]);

  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[styles.drawer, { transform: [{ translateX }] }]}
        >
          <SafeAreaView style={styles.drawerInner} edges={['top', 'bottom', 'left']}>
            <Text style={styles.brand}>PARAKEET</Text>
            <View style={styles.items}>
              <DrawerItem
                icon="settings-outline"
                label="Settings"
                onPress={() => go('/(tabs)/settings')}
                styles={styles}
                colors={colors}
              />
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function DrawerItem({
  icon,
  label,
  onPress,
  styles,
  colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof buildStyles>;
  colors: ColorScheme;
}) {
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
      <Text style={styles.itemLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    root: { flex: 1 },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    drawer: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: DRAWER_WIDTH,
      backgroundColor: colors.bgSurface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    drawerInner: {
      flex: 1,
      paddingHorizontal: spacing[4],
      paddingTop: spacing[4],
    },
    brand: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.black,
      color: colors.primary,
      letterSpacing: typography.letterSpacing.wider,
      paddingHorizontal: spacing[2],
      paddingBottom: spacing[4],
    },
    items: {
      gap: spacing[1],
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      borderRadius: radii.sm,
    },
    itemLabel: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
  });
}

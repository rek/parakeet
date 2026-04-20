import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFeatureEnabled } from '@modules/feature-flags';
import { useInProgressSession } from '@modules/session';
import { useSessionStore } from '@platform/store/sessionStore';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { radii, spacing, typography } from '../../theme';
import type { ColorScheme } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

export function LeftDrawer({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const drawerWidth = Math.min(300, windowWidth * 0.8);
  const styles = useMemo(
    () => buildStyles(colors, drawerWidth),
    [colors, drawerWidth],
  );
  const translateX = useRef(new Animated.Value(-drawerWidth)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const { data: activeSession } = useInProgressSession();
  const nutritionEnabled = useFeatureEnabled('nutrition');

  useEffect(() => {
    if (visible) {
      translateX.setValue(-drawerWidth);
      overlayOpacity.setValue(0);
    }
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : -drawerWidth,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateX, overlayOpacity, drawerWidth]);

  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };

  const goCurrentSession = () => {
    if (!activeSession) return;
    onClose();
    const jit = useSessionStore.getState().cachedJitData;
    router.push({
      pathname: '/session/[sessionId]',
      params: {
        sessionId: activeSession.id,
        ...(jit ? { jitData: jit } : {}),
      },
    });
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
                icon="flash-outline"
                label="Today"
                onPress={() => go('/(tabs)/today')}
                styles={styles}
                colors={colors}
              />
              {activeSession && (
                <DrawerItem
                  icon="barbell-outline"
                  label="Current Session"
                  onPress={goCurrentSession}
                  styles={styles}
                  colors={colors}
                />
              )}
              {nutritionEnabled && (
                <DrawerItem
                  icon="nutrition-outline"
                  label="Nutrition"
                  onPress={() => go('/(tabs)/nutrition')}
                  styles={styles}
                  colors={colors}
                />
              )}
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

function buildStyles(colors: ColorScheme, drawerWidth: number) {
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
      width: drawerWidth,
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

import { Tabs } from 'expo-router'
import { colors } from '../../theme'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tabs.Screen name="today"    options={{ title: 'Today',    tabBarLabel: 'Today' }} />
      <Tabs.Screen name="program"  options={{ title: 'Program',  tabBarLabel: 'Program' }} />
      <Tabs.Screen name="history"  options={{ title: 'History',  tabBarLabel: 'History' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
    </Tabs>
  )
}

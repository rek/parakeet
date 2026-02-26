import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function tabIcon(focused: boolean, active: IoniconsName, inactive: IoniconsName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  )
}

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
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarLabel: 'Today',
          tabBarIcon: ({ color, size, focused }) =>
            tabIcon(focused, 'flash', 'flash-outline')({ color, size }),
        }}
      />
      <Tabs.Screen
        name="program"
        options={{
          title: 'Program',
          tabBarLabel: 'Program',
          tabBarIcon: ({ color, size, focused }) =>
            tabIcon(focused, 'barbell', 'barbell-outline')({ color, size }),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size, focused }) =>
            tabIcon(focused, 'stats-chart', 'stats-chart-outline')({ color, size }),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size, focused }) =>
            tabIcon(focused, 'settings', 'settings-outline')({ color, size }),
        }}
      />
    </Tabs>
  )
}

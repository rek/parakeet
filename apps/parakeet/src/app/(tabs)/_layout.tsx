import { Tabs } from 'expo-router'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#111827' }}>
      <Tabs.Screen name="today"    options={{ title: 'Today',    tabBarLabel: 'Today' }} />
      <Tabs.Screen name="program"  options={{ title: 'Program',  tabBarLabel: 'Program' }} />
      <Tabs.Screen name="history"  options={{ title: 'History',  tabBarLabel: 'History' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
    </Tabs>
  )
}

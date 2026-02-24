import { Tabs } from 'expo-router'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#111827' }}>
      <Tabs.Screen name="today"    options={{ title: 'Today',    tabBarLabel: 'Today' }} />
    </Tabs>
  )
}

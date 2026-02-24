import { StyleSheet, Text, View } from 'react-native'

interface BlockBadgeProps {
  block: number | null
}

interface BadgeConfig {
  backgroundColor: string
  color: string
  label: string
}

function getBadgeConfig(block: number | null): BadgeConfig {
  switch (block) {
    case 1:
      return { backgroundColor: '#DBEAFE', color: '#1D4ED8', label: 'B1' }
    case 2:
      return { backgroundColor: '#FED7AA', color: '#C2410C', label: 'B2' }
    case 3:
      return { backgroundColor: '#FECACA', color: '#B91C1C', label: 'B3' }
    default:
      return { backgroundColor: '#F3F4F6', color: '#6B7280', label: 'DL' }
  }
}

export function BlockBadge({ block }: BlockBadgeProps) {
  const config = getBadgeConfig(block)

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
})

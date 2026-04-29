import { SafeAreaView } from 'react-native-safe-area-context';

import { WearableSettings } from '@modules/wearable';

export default function WearableSettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <WearableSettings />
    </SafeAreaView>
  );
}

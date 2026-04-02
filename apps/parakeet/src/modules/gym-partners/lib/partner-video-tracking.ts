import { captureException } from '@platform/utils/captureException';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SEEN_PARTNER_VIDEO_KEY = '@parakeet/lastSeenPartnerVideo';

export async function getLastSeenPartnerVideoTimestamp() {
  try {
    return await AsyncStorage.getItem(LAST_SEEN_PARTNER_VIDEO_KEY);
  } catch (err) {
    captureException(err);
    return null;
  }
}

export async function setLastSeenPartnerVideoTimestamp({
  timestamp,
}: {
  timestamp: string;
}) {
  try {
    await AsyncStorage.setItem(LAST_SEEN_PARTNER_VIDEO_KEY, timestamp);
  } catch (err) {
    captureException(err);
  }
}

import { Image, Text } from 'react-native';

import type { BadgeId } from '@parakeet/training-engine';

import { BADGE_IMAGES } from './badge-images';

interface BadgeIconProps {
  badgeId: BadgeId;
  emoji: string;
  /** Display size in points (default 32). */
  size?: number;
}

export function BadgeIcon({ badgeId, emoji, size = 32 }: BadgeIconProps) {
  const source = BADGE_IMAGES[badgeId];

  if (source) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <Text style={{ fontSize: size * 0.7, width: size, textAlign: 'center' }}>
      {emoji}
    </Text>
  );
}

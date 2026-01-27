import React from 'react';
import { Platform } from 'react-native';
import { IconSymbol } from './icon-symbol';
import { FontAwesome } from '@expo/vector-icons';
import type { OpaqueColorValue } from 'react-native';

type Props = {
  size?: number;
  color: string | OpaqueColorValue;
};

export function UserIcon({ size = 24, color }: Props) {
  if (Platform.OS === 'web') {
    return <FontAwesome name="user-circle" size={size} color={String(color)} />;
  }
  return <IconSymbol name="person.circle" size={size} color={color} />;
}

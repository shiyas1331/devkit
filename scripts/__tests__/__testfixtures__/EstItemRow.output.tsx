import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

interface EstItemProps {
  estName: string;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}

export const EstItem = ({ estName, onPress, testID, accessibilityLabel }: EstItemProps) => (
  <TouchableOpacity
    onPress={onPress}
    testID={testID ?? 'est-row'}
    accessibilityLabel={accessibilityLabel ?? estName}>
    <Text>{estName}</Text>
  </TouchableOpacity>
);

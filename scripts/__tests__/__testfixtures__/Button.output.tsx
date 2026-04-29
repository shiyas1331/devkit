import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { deriveTestId } from './utils/locator';

interface ButtonProps {
  text: string;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}

export const Button = ({ text, onPress, testID, accessibilityLabel }: ButtonProps) => (
  <TouchableOpacity
    onPress={onPress}
    testID={testID ?? deriveTestId(text, 'button')}
    accessibilityLabel={accessibilityLabel}>
    <Text>{text}</Text>
  </TouchableOpacity>
);
